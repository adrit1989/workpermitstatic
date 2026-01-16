const { getConnection, sql } = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// --- 1. IST TIME FORMATTER (DD-MM-YYYY, HH:MM) ---
function formatIST(date) {
    if (!date) return '-';
    // Ensure we parse various SQL date formats correctly
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleString("en-IN", { 
        timeZone: "Asia/Kolkata", 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: false 
    }).replace(/\//g, '-'); // Force hyphens: 16-01-2026
}

// --- 2. CHECKLIST DATA ---
const CHECKLIST_DATA = { 
    A: ["1. Equipment / Work Area inspected.", "2. Surrounding area checked, cleaned.", "3. Manholes/Sewers covered.", "4. Considered hazards.", "5. Equipment blinded/isolated.", "6. Equipment drained/depressurized.", "7. Equipment steamed/purged.", "8. Equipment water flushed.", "9. Access for Fire Tender.", "10. Iron Sulfide removed.", "11. Electrical isolation.", "12. Gas Test: HC/Toxic/O2.", "13. Firefighting system available.", "14. Area cordoned off.", "15. CCTV monitoring.", "16. Ventilation/Lighting."], 
    B: ["1. Means of exit.", "2. Standby personnel.", "3. Checked for oil/gas trapped.", "4. Spark shield.", "5. Grounding.", "6. Standby for confined space.", "7. Communication.", "8. Rescue equipment.", "9. Space cooled.", "10. Inert gas.", "11. ELCB/Earthing.", "12. Cylinders outside.", "13. Spark arrestor.", "14. Welding machine safe.", "15. Height permit taken."], 
    C: ["1. Spark elimination system on vehicle."], 
    D: ["1. Shoring/sloping provided.", "2. Soil at safe distance.", "3. Access provided.", "4. No heavy vehicle movement."] 
};

// --- 3. HEADER DRAWING FUNCTION ---
function drawHeader(doc, bgColor, permitNo) {
    // Background Color
    if (bgColor && bgColor !== 'White') {
        doc.rect(0, 0, 595, 842).fill(bgColor);
    }
    
    // Logo & Header Text
    // Note: If logos are missing, we skip them to prevent crash
    try {
        const logoPath = path.resolve(__dirname, '../logo.png');
        if (fs.existsSync(logoPath)) doc.image(logoPath, 30, 30, { width: 50 });
        
        const rhinoPath = path.resolve(__dirname, '../rhino.png');
        if (fs.existsSync(rhinoPath)) doc.image(rhinoPath, 500, 30, { width: 50 });
    } catch(e) {}

    doc.fillColor('black');
    doc.fontSize(16).font('Helvetica-Bold').text('IndianOil - Work Permit', 0, 40, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Permit No: ${permitNo}`, { align: 'center' });
    doc.rect(30, 90, 535, 2).fill('#ea580c'); // Orange line
    doc.fillColor('black');
    doc.y = 110;
}

module.exports = async function (context, req) {
    try {
        const { permitId } = req.params;
        
        const pool = await getConnection();
        const result = await pool.request().input('p', permitId).query("SELECT * FROM Permits WHERE PermitID = @p");

        if (!result.recordset.length) {
            context.res = { status: 404, body: "Permit Not Found" };
            return;
        }

        const p = result.recordset[0];
        // Safe Parse of FullDataJSON (contains form fields)
        let d = {};
        try { d = p.FullDataJSON ? JSON.parse(p.FullDataJSON) : {}; } catch(e) {}

        // --- MERGE DATA FOR ACCURACY ---
        // We prioritize SQL columns for status/timestamps over the JSON blob
        d.Reviewer_Status = p.Reviewer_Status;
        d.Reviewer_Name = p.Reviewer_Name;
        d.Reviewer_ActionDate = p.Reviewer_ActionDate;
        d.Approver_Status = p.Approver_Status;
        d.Approver_Name = p.Approver_Name;
        d.Approver_ActionDate = p.Approver_ActionDate;

        const compositePermitNo = `${d.IssuedToDept || 'DEPT'}/${p.PermitID}`;
        const bgColor = d.PdfBgColor || 'White';

        // --- PDF SETUP ---
        const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // Draw Initial Header
        drawHeader(doc, bgColor, compositePermitNo);

        // --- 1. SAFETY BANNER ---
        try {
            const bannerPath = path.resolve(__dirname, '../safety_banner.png');
            if (fs.existsSync(bannerPath)) {
                doc.image(bannerPath, 30, doc.y, { width: 535, height: 100 });
                doc.y += 110;
            }
        } catch(e) {}

        // --- 2. GSR ACCEPTANCE ---
        if(d.GSR_Accepted === 'Y') {
             doc.rect(30, doc.y, 535, 25).fillColor('#ecfccb').fill(); // Light green bg
             doc.strokeColor('black').rect(30, doc.y - 25, 535, 25).stroke();
             doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold')
                .text("✓ I have read, understood and accepted the IOCL Golden Safety Rules terms and penalties.", 40, doc.y - 18);
             doc.y += 10;
             doc.fillColor('black');
        }

        // --- 3. APPROVAL STATUS BOX (With Timestamps) ---
        const boxY = doc.y;
        doc.rect(30, boxY, 535, 90).stroke();
        
        doc.fontSize(10).font('Helvetica-Bold').text('APPROVAL STATUS', 40, boxY + 10, { underline: true });
        doc.fontSize(9).font('Helvetica');

        // Requester
        doc.text(`REQUESTER: ${d.RequesterName} (Created: ${formatIST(p.CreatedDate)})`, 40, boxY + 25);

        // Reviewer
        if (p.Reviewer_Status === 'Approved') {
            doc.fillColor('green').text(`REVIEWER: Approved by ${p.Reviewer_Name}`, 40, boxY + 40);
            doc.text(`(Date: ${formatIST(p.Reviewer_ActionDate)})`, 300, boxY + 40);
        } else {
            doc.fillColor('gray').text('REVIEWER: Pending', 40, boxY + 40);
        }

        // Approver
        if (p.Approver_Status === 'Approved') {
            doc.fillColor('green').text(`APPROVER: Approved by ${p.Approver_Name}`, 40, boxY + 55);
            doc.text(`(Date: ${formatIST(p.Approver_ActionDate)})`, 300, boxY + 55);
        } else {
            doc.fillColor('gray').text('APPROVER: Pending', 40, boxY + 55);
        }
        
        doc.fillColor('black');
        doc.y = boxY + 100;

        // --- 4. DETAILS ---
        doc.fontSize(10).font('Helvetica-Bold').text("PERMIT DETAILS", 30, doc.y);
        doc.fontSize(9).font('Helvetica');
        doc.y += 15;

        const details = [
            `Work Type: ${p.WorkType}`,
            `Location: ${p.LocationUnit} (${p.ExactLocation || 'No GPS'})`,
            `Valid From: ${formatIST(p.ValidFrom)}`,
            `Valid To:   ${formatIST(p.ValidTo)}`,
            `Vendor: ${d.Vendor || '-'}`,
            `Description: ${d.Desc || '-'}`
        ];
        
        details.forEach(l => { doc.text(l, 30, doc.y); doc.y += 12; });
        doc.moveDown();

        // --- 5. CHECKLISTS ---
        const drawChecklist = (title, items, prefix) => {
            if (doc.y > 650) { doc.addPage(); drawHeader(doc, bgColor, compositePermitNo); }
            doc.font('Helvetica-Bold').fontSize(10).text(title, 30, doc.y + 10);
            doc.y += 25;
            doc.fontSize(8).font('Helvetica');
            
            items.forEach((item, idx) => {
                const key = `${prefix}_Q${idx+1}`;
                const status = d[key];
                if (status === 'Yes' || status === 'NA') {
                    if (doc.y > 750) { doc.addPage(); drawHeader(doc, bgColor, compositePermitNo); }
                    const icon = status === 'Yes' ? '[YES]' : '[NA]';
                    let text = `${icon} ${item}`;
                    
                    // Add details (like Gas readings) if present
                    if(d[`${key}_Detail`]) text += ` -> ${d[`${key}_Detail`]}`;
                    if(prefix === 'A' && idx === 11) { // Gas Test
                         text += ` [HC:${d.GP_Q12_HC||'-'}%, Tox:${d.GP_Q12_ToxicGas||'-'}, O2:${d.GP_Q12_Oxygen||'-'}%]`;
                    }

                    doc.text(text, 30, doc.y);
                    doc.y += 12;
                }
            });
        };

        drawChecklist("SECTION A: GENERAL", CHECKLIST_DATA.A, 'A');
        drawChecklist("SECTION B: HOT WORK / CONFINED SPACE", CHECKLIST_DATA.B, 'B');
        
        // --- 6. WORKERS ---
        if (doc.y > 600) { doc.addPage(); drawHeader(doc, bgColor, compositePermitNo); }
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(10).text("WORKERS DEPLOYED", 30, doc.y);
        doc.y += 15;
        doc.fontSize(8).font('Helvetica');
        
        let workers = [];
        try { 
            if(d.SelectedWorkers) workers = typeof d.SelectedWorkers === 'string' ? JSON.parse(d.SelectedWorkers) : d.SelectedWorkers;
        } catch(e) {}

        if(workers.length > 0) {
            workers.forEach(w => {
                doc.text(`- ${w.Name} (${w.Age}) | ID: ${w.ID}`, 30, doc.y);
                doc.y += 12;
            });
        } else {
            doc.text("No workers listed.", 30, doc.y);
            doc.y += 12;
        }

        // --- 7. RENEWALS ---
        if (doc.y > 600) { doc.addPage(); drawHeader(doc, bgColor, compositePermitNo); }
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(10).text("RENEWAL HISTORY", 30, doc.y);
        doc.y += 15;
        doc.fontSize(8).font('Helvetica');
        
        let renewals = [];
        try { renewals = JSON.parse(p.RenewalsJSON || "[]"); } catch(e){}

        if (renewals.length > 0) {
            renewals.forEach(r => {
                doc.text(`> ${formatIST(r.valid_from)} to ${formatIST(r.valid_till)} | Status: ${r.status.toUpperCase()}`, 30, doc.y);
                doc.y += 12;
                doc.text(`  Appr: ${r.app_name || '-'} (${formatIST(r.app_at)}) | Gas: ${r.hc}/${r.toxic}/${r.oxygen}`, 30, doc.y, {color: 'gray'});
                doc.y += 15;
                doc.fillColor('black');
            });
        } else {
            doc.text("No renewals.", 30, doc.y);
        }

        // --- 8. CLOSURE ---
        if (p.Status.includes('Closed')) {
            if (doc.y > 650) { doc.addPage(); drawHeader(doc, bgColor, compositePermitNo); }
            doc.moveDown();
            doc.font('Helvetica-Bold').fontSize(10).text("CLOSURE", 30, doc.y);
            doc.y += 15;
            doc.fontSize(8).font('Helvetica');
            doc.text(`Site Restored: ${p.Site_Restored_Check === 'Y' ? 'YES' : 'NO'}`);
            doc.y += 12;
            doc.text(`Closed By: ${p.Closure_Approver_Sig} on ${formatIST(p.Closure_Approver_Date)}`);
            doc.y += 12;
            doc.text(`Remarks: ${p.Closure_Approver_Remarks || '-'}`);
        }

        // Footer
        doc.end();

        await new Promise(resolve => doc.on('end', resolve));
        const pdfData = Buffer.concat(buffers);

        context.res = {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Permit_${p.PermitID}.pdf`
            },
            body: pdfData
        };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: e.message };
    }
};

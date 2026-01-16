const { getConnection, sql } = require('../db');
const PDFDocument = require('pdfkit');
const { drawHeader, CHECKLIST_DATA, formatDate } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = async function (context, req) {
    try {
        const id = context.bindingData.id; // Get Permit ID from URL
        
        const pool = await getConnection();
        const result = await pool.request().input('p', id).query("SELECT * FROM Permits WHERE PermitID = @p");

        if (!result.recordset.length) {
            context.res = { status: 404, body: "Permit Not Found" };
            return;
        }

        const p = result.recordset[0];
        const d = JSON.parse(p.FullDataJSON);

        // --- PDF GENERATION START ---
        const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
        
        // Capture PDF in memory
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        const compositePermitNo = `${d.IssuedToDept || 'DEPT'}/${p.PermitID}`;
        const bgColor = d.PdfBgColor || 'White';

        // Helper to draw header on new pages
        const drawHeaderOnAll = () => {
            drawHeader(doc, bgColor, compositePermitNo);
            doc.y = 135; 
            doc.fontSize(9).font('Helvetica');
        };

        drawHeaderOnAll();

        // Banner Image (Try/Catch to prevent crash if missing)
        try {
            const bannerPath = path.resolve(__dirname, '../safety_banner.png');
            if (fs.existsSync(bannerPath)) {
                doc.image(bannerPath, 30, doc.y, { width: 535, height: 100 });
                doc.y += 110;
            }
        } catch(err) { context.log("Banner image warning:", err.message); }

        // GSR Acceptance
        if(d.GSR_Accepted === 'Y') {
             doc.rect(30, doc.y, 535, 20).fillColor('#e6fffa').fill(); 
             doc.fillColor('black').stroke(); 
             doc.rect(30, doc.y, 535, 20).stroke(); 
             doc.font('Helvetica-Bold').fontSize(9).fillColor('#047857')
                .text("✓ I have read, understood and accepted the IOCL Golden Safety Rules terms and penalties.", 35, doc.y + 5);
             doc.y += 25;
             doc.fillColor('black');
        }

        doc.font('Helvetica-Bold').fontSize(10).text(`Permit No: ${compositePermitNo}`, 30, doc.y);
        doc.fontSize(9).font('Helvetica');
        doc.y += 15;
        const startY = doc.y;

        const dateFrom = formatDate(p.ValidFrom);
        const dateTo = formatDate(p.ValidTo);
        doc.text(`(i) Work clearance from: ${dateFrom}    To    ${dateTo} (Valid for the shift unless renewed).`, 30, doc.y);
        doc.y += 15;

        doc.text(`(ii) Issued to (Dept/Section/Contractor): ${d.IssuedToDept || '-'} / ${d.Vendor || '-'}`, 30, doc.y);
        doc.y += 15;

        const coords = d.ExactLocation || 'No GPS Data';
        const locDetail = d.WorkLocationDetail || '-';
        doc.text(`(iii) Exact Location of work (Area/RCP/SV/Chainage): ${locDetail} [GPS: ${coords}]`, 30, doc.y);
        doc.y += 15;

        doc.text(`(iv) Description of work: ${d.Desc || '-'}`, 30, doc.y, {width: 535});
        doc.y += 20;

        const siteContact = d.EmergencyContact || 'Not Provided';
        doc.text(`(v) Person from Contractor / Dept. at site (Name & Contact): ${d.RequesterName} / ${siteContact}`, 30, doc.y);
        doc.y += 15;

        doc.text(`(vi) Patrolling/ security Guard at site (Name & Contact): ${d.SecurityGuard || '-'}`, 30, doc.y);
        doc.y += 15;

        const jsa = d.JsaNo || '-';
        const wo = d.WorkOrder || '-';
        doc.text(`(vii) JSA Ref. No: ${jsa} | Cross-Reference/WO: ${wo}`, 30, doc.y);
        doc.y += 15;

        doc.text(`(viii) Name & contact no. of person in case of emergency: ${d.EmergencyContact || '-'}`, 30, doc.y);
        doc.y += 15;

        doc.text(`(ix) Nearest Fire station and Hospital: ${d.FireStation || '-'}`, 30, doc.y);
        doc.y += 20;

        doc.rect(25, startY - 5, 545, doc.y - startY + 5).stroke();
        doc.y += 10;
        
        // --- CHECKLISTS ---
        const drawChecklist = (t,i,pr) => { 
            if(doc.y>650){doc.addPage(); drawHeaderOnAll(); doc.y=135;} 
            doc.font('Helvetica-Bold').fillColor('black').fontSize(9).text(t,30,doc.y+10); doc.y+=25; 
            let y=doc.y;
            doc.rect(30,y,350,20).stroke().text("Item",35,y+5); doc.rect(380,y,60,20).stroke().text("Sts",385,y+5); doc.rect(440,y,125,20).stroke().text("Rem",445,y+5); y+=20;
            doc.font('Helvetica').fontSize(8);
            i.forEach((x,k)=>{
                let rowH = 20;
                if(pr === 'A' && k === 11) rowH = 45; 

                if(y + rowH > 750){doc.addPage(); drawHeaderOnAll(); doc.y=135; y=135;}
                const st = d[`${pr}_Q${k+1}`]||'NA';
                if(d[`${pr}_Q${k+1}`]) {
                    doc.rect(30,y,350,rowH).stroke().text(x,35,y+5,{width:340});
                    doc.rect(380,y,60,rowH).stroke().text(st,385,y+5); 
                    
                    let detailTxt = d[`${pr}_Q${k+1}_Detail`]||'';
                    if(pr === 'A' && k === 11) { 
                         const hc = d.GP_Q12_HC || '_';
                         const tox = d.GP_Q12_ToxicGas || '_';
                         const o2 = d.GP_Q12_Oxygen || '_';
                         detailTxt = `HC: ${hc}% LEL\nTox: ${tox} PPM\nO2: ${o2}%`;
                    }
                    doc.rect(440,y,125,rowH).stroke().text(detailTxt,445,y+5);
                    y+=rowH; 
                }
            }); doc.y=y;
        };

        drawChecklist("SECTION A: GENERAL", CHECKLIST_DATA.A,'A');
        drawChecklist("SECTION B : For Hot work / Entry to confined Space", CHECKLIST_DATA.B,'B');
        drawChecklist("SECTION C: For vehicle Entry in Hazardous area", CHECKLIST_DATA.C,'C'); 
        drawChecklist("SECTION D: EXCAVATION", CHECKLIST_DATA.D,'D');

        if(doc.y>600){doc.addPage(); drawHeaderOnAll(); doc.y=135;}
        doc.font('Helvetica-Bold').fontSize(9).text("Annexure III: ATTACHMENT TO MAINLINE WORK PERMIT", 30, doc.y); doc.y+=15;
        
        // --- ANNEXURE III ---
        const annexData = [
            ["Approved SOP/SWP/SMP No", d.SopNo || '-'],
            ["Approved Site Specific JSA No", d.JsaNo || '-'],
            ["IOCL Equipment", d.IoclEquip || '-'],
            ["Contractor Equipment", d.ContEquip || '-'],
            ["Work Order", d.WorkOrder || '-'],
            ["Tool Box Talk", d.ToolBoxTalk || '-']
        ];

        let axY = doc.y;
        doc.font('Helvetica').fontSize(9);
        doc.fillColor('#eee');
        doc.rect(30, axY, 200, 20).fill().stroke();
        doc.rect(230, axY, 335, 20).fill().stroke();
        doc.fillColor('black');
        doc.font('Helvetica-Bold').text("Parameter", 35, axY+5);
        doc.text("Details", 235, axY+5);
        axY += 20;

        doc.font('Helvetica');
        annexData.forEach(row => {
            doc.rect(30, axY, 200, 20).stroke();
            doc.text(row[0], 35, axY+5);
            doc.rect(230, axY, 335, 20).stroke();
            doc.text(row[1], 235, axY+5);
            axY += 20;
        });
        doc.y = axY + 20;

        // --- SUPERVISOR TABLES ---
        const drawSupTable = (title, headers, dataRows) => {
            if(doc.y > 650) { doc.addPage(); drawHeaderOnAll(); doc.y=135; }
             doc.font('Helvetica-Bold').text(title, 30, doc.y);
            doc.y += 15; 
            const headerHeight = 20; 
             let currentY = doc.y;
            let currentX = 30;
            headers.forEach(h => {
                doc.rect(currentX, currentY, h.w, headerHeight).stroke();
                doc.text(h.t, currentX + 2, currentY + 6, { width: h.w - 4, align: 'left' });
                currentX += h.w;
            });
            currentY += headerHeight;
            doc.font('Helvetica');
            dataRows.forEach(row => {
                let maxRowHeight = 20; 
                row.forEach((cell, idx) => {
                    const cellWidth = headers[idx].w - 4;
                    const textHeight = doc.heightOfString(cell, { width: cellWidth, align: 'left' });
                    if (textHeight + 10 > maxRowHeight) maxRowHeight = textHeight + 10;
                });
                if(currentY + maxRowHeight > 750) { 
                     doc.addPage(); drawHeaderOnAll(); currentY = 135; 
                 }
                let rowX = 30;
                row.forEach((cell, idx) => {
                    doc.rect(rowX, currentY, headers[idx].w, maxRowHeight).stroke();
                    doc.text(cell, rowX + 2, currentY + 5, { width: headers[idx].w - 4, align: 'left' });
                    rowX += headers[idx].w;
                });
                currentY += maxRowHeight;
            });
            doc.y = currentY + 15;
        };

        const ioclSups = d.IOCLSupervisors || [];
        let ioclRows = ioclSups.map(s => {
            let auditText = `Add: ${s.added_by||'-'} (${s.added_at||'-'})`;
            if(s.is_deleted) auditText += `\nDel: ${s.deleted_by} (${s.deleted_at})`;
            return [s.name, s.desig, s.contact, auditText];
        });
        if(ioclRows.length === 0) ioclRows.push(["-", "-", "-", "-"]);
        
        drawSupTable("Authorized Work Supervisor (IOCL)", [{t:"Name", w:130}, {t:"Designation", w:130}, {t:"Contact", w:100}, {t:"Audit Trail", w:175}], ioclRows);
        
        const contRows = [[d.RequesterName || '-', "Site In-Charge / Requester", d.EmergencyContact || '-']];
        drawSupTable("Authorized Work Supervisor (Contractor)", [{t:"Name", w:180}, {t:"Designation", w:180}, {t:"Contact", w:175}], contRows);

        // --- HAZARDS & PPE ---
        if(doc.y>650){doc.addPage(); drawHeaderOnAll(); doc.y=135;}
        doc.font('Helvetica-Bold').text("HAZARDS & PRECAUTIONS",30,doc.y); doc.y+=15; doc.rect(30,doc.y,535,60).stroke();
        const hazKeys = ["Lack of Oxygen", "H2S", "Toxic Gases", "Combustible gases", "Pyrophoric Iron", "Corrosive Chemicals", "cave in formation"];
        const foundHaz = hazKeys.filter(k => d[`H_${k.replace(/ /g,'')}`] === 'Y');
        if(d.H_Others==='Y') foundHaz.push(`Others: ${d.H_Others_Detail}`);
        doc.text(`1.The activity has the following expected residual hazards: ${foundHaz.join(', ')}`,35,doc.y+5); 
        
        const ppeKeys = ["Helmet","Safety Shoes","Hand gloves","Boiler suit","Face Shield","Apron","Goggles","Dust Respirator","Fresh Air Mask","Lifeline","Safety Harness","Airline","Earmuff","IFR"];
        const foundPPE = ppeKeys.filter(k => d[`P_${k.replace(/ /g,'')}`] === 'Y');
        if(d.AdditionalPrecautions && d.AdditionalPrecautions.trim() !== '') { foundPPE.push(`(Other: ${d.AdditionalPrecautions})`); }
        doc.text(`2.Following additional PPE to be used in addition to standards PPE: ${foundPPE.join(', ')}`,35,doc.y+25); doc.y+=70;

        // --- WORKERS DEPLOYED ---
        if(doc.y>650){doc.addPage(); drawHeaderOnAll(); doc.y=135;}
        doc.font('Helvetica-Bold').text("WORKERS DEPLOYED",30,doc.y); doc.y+=15; 
        let wy = doc.y;
        
        doc.rect(30,wy,80,20).stroke().text("Name",35,wy+5); 
        doc.rect(110,wy,40,20).stroke().text("Gender",112,wy+5);
        doc.rect(150,wy,30,20).stroke().text("Age",152,wy+5); 
        doc.rect(180,wy,90,20).stroke().text("ID Details",182,wy+5); 
        doc.rect(270,wy,80,20).stroke().text("Requestor",272,wy+5);
        doc.rect(350,wy,215,20).stroke().text("Approved On / By",352,wy+5); 
        wy+=20;
        let workers = d.SelectedWorkers || [];
        if (typeof workers === 'string') { try { workers = JSON.parse(workers); } catch (e) { workers = []; } }
        doc.font('Helvetica').fontSize(8);
        workers.forEach(w => {
            if(wy>750){doc.addPage(); drawHeaderOnAll(); doc.y=135; wy=135;}
            doc.rect(30,wy,80,35).stroke().text(w.Name,35,wy+5); 
            doc.rect(110,wy,40,35).stroke().text(w.Gender||'-',112,wy+5); 
            doc.rect(150,wy,30,35).stroke().text(w.Age,152,wy+5); 
            doc.rect(180,wy,90,35).stroke().text(`${w.IDType || ''}: ${w.ID || '-'}`,182,wy+5); 
            doc.rect(270,wy,80,35).stroke().text(w.RequestorName || '-', 272,wy+5);
            doc.rect(350,wy,215,35).stroke().text(`${w.ApprovedAt || '-'} by ${w.ApprovedBy || 'Admin'}`, 352,wy+5); 
            wy+=35;
        });
        doc.y = wy+20;

        // --- SIGNATURES ---
        if(doc.y > 650) { doc.addPage(); drawHeaderOnAll(); doc.y = 135; }
        doc.font('Helvetica-Bold').text("SIGNATURES",30,doc.y); 
        doc.y+=15; const sY=doc.y;
        doc.rect(30,sY,178,40).stroke().text(`REQ: ${d.RequesterName} on ${d.CreatedDate||'-'}`,35,sY+5);
        doc.rect(208,sY,178,40).stroke().text(`REV: ${d.Reviewer_Sig||'-'}\nRem: ${d.Reviewer_Remarks||'-'}`, 213, sY+5, {width:168});
        doc.rect(386,sY,179,40).stroke().text(`APP: ${d.Approver_Sig||'-'}\nRem: ${d.Approver_Remarks||'-'}`, 391, sY+5, {width:169}); 
        doc.y=sY+50;

        // --- RENEWALS ---
        if(doc.y>650){doc.addPage(); drawHeaderOnAll(); doc.y=135;}
        doc.font('Helvetica-Bold').text("CLEARANCE RENEWAL",30,doc.y); doc.y+=15;
        let ry = doc.y;
        doc.rect(30,ry,50,25).stroke().text("From",32,ry+5); doc.rect(80,ry,50,25).stroke().text("To",82,ry+5);
        doc.rect(130,ry,60,25).stroke().text("Gas",132,ry+5); doc.rect(190,ry,70,25).stroke().text("Precautions",192,ry+5);
        doc.rect(260,ry,70,25).stroke().text("Workers",262,ry+5);
        doc.rect(330,ry,75,25).stroke().text("Req",332,ry+5); doc.rect(405,ry,75,25).stroke().text("Rev",407,ry+5);
        doc.rect(480,ry,75,25).stroke().text("App",482,ry+5);
        ry+=25;
        const renewals = JSON.parse(p.RenewalsJSON || "[]");
        doc.font('Helvetica').fontSize(8);
        renewals.forEach(r => {
             if(ry>700){doc.addPage(); drawHeaderOnAll(); doc.y=135; ry=135;}
             doc.rect(30,ry,50,55).stroke().text(r.valid_from.replace('T','\n'), 32, ry+5, {width:48});
             doc.rect(80,ry,50,55).stroke().text(r.valid_till.replace('T','\n'), 82, ry+5, {width:48});
             doc.rect(130,ry,60,55).stroke().text(`HC: ${r.hc}\nTox: ${r.toxic}\nO2: ${r.oxygen}`, 132, ry+5, {width:58});
             doc.rect(190,ry,70,55).stroke().text(r.precautions||'-', 192, ry+5, {width:68});
             const wList = r.worker_list ? r.worker_list.join(', ') : 'All';
             doc.rect(260,ry,70,55).stroke().text(wList, 262, ry+5, {width:68});
             doc.rect(330,ry,75,55).stroke().text(`${r.req_name}\n${r.req_at}`, 332, ry+5, {width:73});
             let revText = `${r.rev_name||'-'}\n${r.rev_at||'-'}\nRem: ${r.rev_rem||'-'}`;
             let appText = `${r.app_name||'-'}\n${r.app_at||'-'}\nRem: ${r.app_rem||'-'}`;
             if (r.status === 'rejected') {
                 const rejText = `REJECTED BY:\n${r.rej_by}\n${r.rej_at}\nReason: ${r.rej_reason}`;
                 if (r.rej_role === 'Reviewer') revText = rejText; else appText = rejText;
             }
             doc.rect(405,ry,75,55).stroke().text(revText, 407, ry+5, {width:73});
             doc.rect(480,ry,75,55).stroke().text(appText, 482, ry+5, {width:73});
             ry += 55;
        });
        doc.y = ry + 20;

        // --- CLOSURE ---
        if(doc.y>650){doc.addPage(); drawHeaderOnAll(); doc.y=135;}
        doc.font('Helvetica-Bold').text("CLOSURE OF WORK PERMIT",30,doc.y); doc.y+=15;
        let cy = doc.y;
        doc.rect(30,cy,80,20).stroke().text("Stage",35,cy+5); doc.rect(110,cy,120,20).stroke().text("Name/Sig",115,cy+5);
        doc.rect(230,cy,100,20).stroke().text("Date/Time",235,cy+5); doc.rect(330,cy,235,20).stroke().text("Remarks",335,cy+5);
        cy+=20;
        const closureSteps = [
            {role:'Requestor', name: d.Closure_Requestor_Sig || d.RequesterName, date:d.Closure_Requestor_Date, rem:d.Closure_Requestor_Remarks},
            {role:'Reviewer', name: d.Closure_Reviewer_Sig, date:d.Closure_Reviewer_Date, rem:d.Closure_Reviewer_Remarks},
            {role:'Approver', name: d.Closure_Approver_Sig || d.Closure_Issuer_Sig, date:d.Closure_Approver_Date, rem:d.Closure_Approver_Remarks}
        ];
        doc.font('Helvetica').fontSize(8);
        closureSteps.forEach(s => {
            doc.rect(30,cy,80,30).stroke().text(s.role,35,cy+5); 
            doc.rect(110,cy,120,30).stroke().text(s.name||'-',115,cy+5, {width:110}); 
            doc.rect(230,cy,100,30).stroke().text(s.date||'-',235,cy+5, {width:90}); 
            doc.rect(330,cy,235,30).stroke().text(s.rem||'-',335,cy+5, {width:225});
            cy+=30;
        });
        doc.y = cy + 20;

        // --- INSTRUCTIONS ---
        if(doc.y>500){doc.addPage(); drawHeaderOnAll(); doc.y=135;} 
        doc.font('Helvetica-Bold').fontSize(10).text("GENERAL INSTRUCTIONS", 30, doc.y); 
        doc.y += 15; 
        doc.font('Helvetica').fontSize(8);
        const instructions = ["1. The work permit shall be filled up carefully.", "2. Appropriate safeguards and PPEs shall be determined.", "3. Requirement of standby personnel shall be mentioned.", "4. Means of communication must be available.", "5. Shift-wise communication to Main Control Room.", "6. Only certified vehicles and electrical equipment allowed.", "7. Welding machines shall be placed in ventilated areas.", "8. No hot work unless explosive meter reading is Zero.", "9. Standby person mandatory for confined space.", "10. Compressed gas cylinders not allowed inside.", "11. While filling trench, men/equipment must be outside.", "12. For renewal, issuer must ensure conditions are satisfactory.", "13. Max renewal up to 7 calendar days.", "14. Permit must be available at site.", "15. On completion, permit must be closed.", "16. Follow latest SOP for Trenching.", "17. CCTV and gas monitoring should be utilized.", "18. Refer to PLHO guidelines for details.", "19. This original permit must always be available with permit receiver.", "20. On completion of the work, the permit must be closed and the original copy of TBT, JSA, Permission etc. associated with permit to be handed over to Permit issuer", "21. A group shall be made for every work with SIC, EIC, permit issuer, Permit receiver, Mainline In charge and authorized contractor supervisor for digital platform", "22. The renewal of permits shall be done through confirmation by digital platform. However, the regularization on permits for renewal shall be done before closure of permit.", "23. No additional worker/supervisor to be engaged unless approved by Permit Receiver."]; 
        instructions.forEach(i => { doc.text(i, 30, doc.y); doc.y += 12; }); 

        // --- WATERMARK ---
        const wmStatus = p.Status.includes('Closed') ? 'CLOSED' : 'ACTIVE'; 
        const wmType = (p.WorkType || '').toUpperCase();
        const wm = `${wmStatus} - ${wmType}`; 
        const color = p.Status.includes('Closed') ? '#ef4444' : '#22c55e'; 
        const range = doc.bufferedPageRange(); 
        for(let i=0; i<range.count; i++) { doc.switchToPage(i); doc.save(); doc.rotate(-45, {origin:[300,400]}); doc.fontSize(60).fillColor(color).opacity(0.15).text(wm, 50, 350, {align:'center'}); doc.restore(); } 
        
        doc.end();

        // --- FINALIZE RESPONSE ---
        await new Promise(resolve => doc.on('end', resolve));
        const pdfData = Buffer.concat(buffers);

        context.res = {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${p.PermitID}.pdf`
            },
            body: pdfData
        };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: e.message };
    }
};
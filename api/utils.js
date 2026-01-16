const fs = require('fs');
const path = require('path');

// --- 1. CHECKLIST DATA ---
const CHECKLIST_DATA = {
    A: [
        "1. Equipment / Work Area inspected.",
        "2. Surrounding area checked, cleaned and covered. Oil/RAGS/Grass Etc removed.",
        "3. Manholes, Sewers, CBD etc. and hot nearby surface covered.",
        "4. Considered hazards from other routine, non-routine operations and concerned person alerted.",
        "5. Equipment blinded/ disconnected/ closed/ isolated/ wedge opened.",
        "6. Equipment properly drained and depressurized.",
        "7. Equipment properly steamed/purged.",
        "8. Equipment water flushed.",
        "9. Access for Free approach of Fire Tender.",
        "10. Iron Sulfide removed/ Kept wet.",
        "11. Equipment electrically isolated and tagged vide Permit no.",
        "12. Gas Test: HC / Toxic / O2 checked.",
        "13. Running water hose / Fire extinguisher provided. Fire water system available.",
        "14. Area cordoned off and Precautionary tag/Board provided.",
        "15. CCTV monitoring facility available at site.",
        "16. Proper ventilation and Lighting provided."
    ],
    B: [
        "1. Proper means of exit / escape provided.",
        "2. Standby personnel provided from Mainline/ Maint. / Contractor/HSE.",
        "3. Checked for oil and Gas trapped behind the lining in equipment.",
        "4. Shield provided against spark.",
        "5. Portable equipment / nozzle properly grounded.",
        "6. Standby persons provided for entry to confined space.",
        "7. Adequate Communication Provided to Stand by Person.",
        "8. Attendant Trained Provided With Rescue Equipment/SCABA.",
        "9. Space Adequately Cooled for Safe Entry Of Person.",
        "10. Continuous Inert Gas Flow Arranged.",
        "11. Check For Earthing/ELCB of all Temporary Electrical Connections being used for welding.",
        "12. Gas Cylinders are kept outside the confined Space.",
        "13. Spark arrestor Checked on mobile Equipments.",
        "14. Welding Machine Checked for Safe Location.",
        "15. Permit taken for working at height Vide Permit No."
    ],
    C: ["1. PESO approved spark elimination system provided on the mobile equipment/ vehicle provided."],
    D: [
        "1. For excavated trench/ pit proper slop/ shoring/ shuttering provided to prevent soil collapse.",
        "2. Excavated soil kept at safe distance from trench/pit edge (min. pit depth).",
        "3. Safe means of access provided inside trench/pit.",
        "4. Movement of heavy vehicle prohibited."
    ]
};

// --- 2. HELPERS ---
function getNowIST() {
    return new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).replace(',', '');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-GB", {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '');
}

// --- 3. PDF HEADER DRAWER ---
function drawHeader(doc, bgColor, permitNoStr) {
    // Note: We need to resolve image paths carefully in Azure Functions
    const logoPath = path.resolve(__dirname, '../logo.png'); 
    
    if(bgColor && bgColor !== 'Auto' && bgColor !== 'White') {
        const colorMap = { 'Red': '#fee2e2', 'Green': '#dcfce7', 'Yellow': '#fef9c3' };
        doc.save();
        doc.fillColor(colorMap[bgColor] || 'white');
        doc.rect(0, 0, doc.page.width, doc.page.height).fill();
        doc.restore();
    }
    const startX=30, startY=30;
    doc.lineWidth(1);
    doc.rect(startX,startY,535,95).stroke();
    // Logo Box (Left)
    doc.rect(startX,startY,80,95).stroke();
    
    if (fs.existsSync(logoPath)) {
        try {
            doc.image(logoPath, startX, startY, { fit: [80, 95], align: 'center', valign: 'center' });
        } catch (err) {
            console.error("Error loading logo:", err.message);
        }
    }

    doc.rect(startX+80,startY,320,95).stroke();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('INDIAN OIL CORPORATION LIMITED', startX+80, startY+15, {width:320, align:'center'});
    doc.fontSize(9).text('EASTERN REGION PIPELINES', startX+80, startY+30, {width:320, align:'center'});
    doc.text('HSE DEPT.', startX+80, startY+45, {width:320, align:'center'});
    doc.fontSize(8).text('COMPOSITE WORK/ COLD WORK/HOT WORK/ENTRY TO CONFINED SPACE/VEHICLE ENTRY / EXCAVATION WORK AT MAINLINE/RCP/SV', startX+80, startY+65, {width:320, align:'center'});
    
    // Right Box
    doc.rect(startX+400,startY,135,95).stroke();
    doc.fontSize(8).font('Helvetica');
    doc.text('Doc No: ERPL/HS&E/25-26', startX+405, startY+60);
    doc.text('Issue No: 01', startX+405, startY+70);
    doc.text('Date: 01.09.2025', startX+405, startY+80);

    // (A) Permit No on All Pages
    if(permitNoStr) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('red');
        doc.text(`Permit No: ${permitNoStr}`, startX+405, startY+15, {width:130, align:'left'});
        doc.fillColor('black');
    }
}

module.exports = {
    CHECKLIST_DATA,
    getNowIST,
    formatDate,
    drawHeader
};
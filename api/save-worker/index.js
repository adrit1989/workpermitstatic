const { getConnection, sql } = require('../db');
const { getNowIST } = require('../utils');

module.exports = async function (context, req) {
    try {
        const { WorkerID, Action, Role, Details, RequestorEmail, RequestorName, ApproverName } = req.body;
        const pool = await getConnection();

        // 1. Validation
        if ((Action === 'create' || Action === 'edit_request') && Details && parseInt(Details.Age) < 18) {
            context.res = { status: 400, body: { error: "Worker must be 18+" } };
            return;
        }

        // 2. CREATE Logic
        if (Action === 'create') {
            const idRes = await pool.request().query("SELECT TOP 1 WorkerID FROM Workers ORDER BY WorkerID DESC");
            // Generate W-1001, W-1002, etc.
            let nextNum = 1001;
            if (idRes.recordset.length > 0) {
                const lastId = idRes.recordset[0].WorkerID; // e.g., "W-1005"
                const split = lastId.split('-');
                if(split.length > 1) nextNum = parseInt(split[1]) + 1;
            }
            const wid = `W-${nextNum}`;

            const dataObj = { Current: {}, Pending: { ...Details, RequestorName: RequestorName } };
            
            await pool.request()
                .input('w', wid)
                .input('s', 'Pending Review')
                .input('r', RequestorEmail)
                .input('j', JSON.stringify(dataObj))
                .input('idt', sql.NVarChar, Details.IDType)
                .query("INSERT INTO Workers (WorkerID, Status, RequestorEmail, DataJSON, IDType) VALUES (@w, @s, @r, @j, @idt)");
            
            context.res = { body: { success: true } };
        }
        
        // 3. EDIT REQUEST Logic
        else if (Action === 'edit_request') {
            const cur = await pool.request().input('w', WorkerID).query("SELECT DataJSON FROM Workers WHERE WorkerID=@w");
            if(cur.recordset.length === 0) { context.res = { status: 404, body: { error: "Worker not found" } }; return; }
            
            let dataObj = JSON.parse(cur.recordset[0].DataJSON);
            dataObj.Pending = { ...dataObj.Current, ...Details, RequestorName: RequestorName || dataObj.Current.RequestorName };
            
            await pool.request()
                .input('w', WorkerID)
                .input('s', 'Edit Pending Review')
                .input('j', JSON.stringify(dataObj))
                .input('idt', sql.NVarChar, Details.IDType)
                .query("UPDATE Workers SET Status=@s, DataJSON=@j, IDType=@idt WHERE WorkerID=@w");

            context.res = { body: { success: true } };
        }
        
        // 4. DELETE Logic
        else if (Action === 'delete') {
            await pool.request().input('w', WorkerID).query("DELETE FROM Workers WHERE WorkerID=@w");
            context.res = { body: { success: true } };
        }
        
        // 5. APPROVE / REJECT Logic
        else {
            const cur = await pool.request().input('w', WorkerID).query("SELECT Status, DataJSON FROM Workers WHERE WorkerID=@w");
            if(cur.recordset.length === 0) { context.res = { status: 404, body: { error: "Worker not found" } }; return; }
            
            let st = cur.recordset[0].Status;
            let dataObj = JSON.parse(cur.recordset[0].DataJSON);
            let appBy = null; 
            let appOn = null;

            if (Action === 'approve') {
                if (st.includes('Pending Review')) {
                    st = st.replace('Review', 'Approval'); // Move to Approver
                } 
                else if (st.includes('Pending Approval')) { 
                    st = 'Approved'; 
                    appBy = ApproverName;
                    appOn = getNowIST();
                    // Move Pending data to Current data
                    dataObj.Current = { ...dataObj.Pending, ApprovedBy: appBy, ApprovedAt: appOn };
                    dataObj.Pending = null; 
                }
            } else if (Action === 'reject') { 
                st = 'Rejected'; 
                dataObj.Pending = null; 
            }
            
            await pool.request()
                .input('w', WorkerID)
                .input('s', st)
                .input('j', JSON.stringify(dataObj))
                .input('aby', sql.NVarChar, appBy)
                .input('aon', sql.NVarChar, appOn)
                .query("UPDATE Workers SET Status=@s, DataJSON=@j, ApprovedBy=@aby, ApprovedOn=@aon WHERE WorkerID=@w");
                
            context.res = { body: { success: true } };
        }

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};
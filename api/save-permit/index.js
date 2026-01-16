const { getConnection, sql } = require('../db');

module.exports = async function (context, req) {
    try {
        const data = req.body;
        const pool = await getConnection();
        
        // 1. Generate Permit ID if New
        let permitId = data.PermitID;
        let isNew = false;

        if (!permitId) {
            isNew = true;
            const countRes = await pool.request().query("SELECT COUNT(*) as count FROM Permits");
            const nextId = countRes.recordset[0].count + 1001;
            permitId = `WP-${nextId}`;
        }

        // 2. Prepare Data
        const request = pool.request()
            .input('pid', permitId)
            .input('status', isNew ? 'Pending Review' : (data.Status || 'Pending Review')) // Reset status on update if needed
            .input('type', data.WorkType)
            .input('email', data.RequesterEmail)
            .input('validFrom', data.ValidFrom || null)
            .input('validTo', data.ValidTo || null)
            .input('created', new Date())
            .input('fullJson', JSON.stringify(data)) // Store everything else as JSON
            .input('workers', JSON.stringify(data.SelectedWorkers || []))
            .input('lat', data.Latitude || null)
            .input('lng', data.Longitude || null)
            .input('locDetail', data.ExactLocation || '')
            .input('unit', data.LocationUnit || '')
            .input('desc', data.Desc || '')
            .input('reqName', data.RequesterName || data.RequesterEmail); // Save Name

        let query = "";
        if (isNew) {
            query = `
                INSERT INTO Permits 
                (PermitID, Status, WorkType, RequesterEmail, RequesterName, ValidFrom, ValidTo, CreatedDate, FullDataJSON, SelectedWorkers, Latitude, Longitude, ExactLocation, LocationUnit, [Desc], GSR_Accepted)
                VALUES 
                (@pid, 'Pending Review', @type, @email, @reqName, @validFrom, @validTo, @created, @fullJson, @workers, @lat, @lng, @locDetail, @unit, @desc, 'Y')
            `;
        } else {
            // UPDATE LOGIC
            query = `
                UPDATE Permits SET 
                    WorkType = @type,
                    ValidFrom = @validFrom,
                    ValidTo = @validTo,
                    FullDataJSON = @fullJson,
                    SelectedWorkers = @workers,
                    Latitude = @lat,
                    Longitude = @lng,
                    ExactLocation = @locDetail,
                    LocationUnit = @unit,
                    [Desc] = @desc,
                    Status = 'Pending Review' -- Re-submit for review
                WHERE PermitID = @pid
            `;
        }

        await request.query(query);

        context.res = { body: { success: true, permitId } };

    } catch (e) {
        context.log.error(e);
        context.res = { status: 500, body: { error: e.message } };
    }
};

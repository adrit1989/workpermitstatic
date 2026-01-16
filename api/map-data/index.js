const { getConnection, sql } = require('../db');
module.exports = async function (context, req) {
    try {
        const pool = await getConnection();
        // Get only active/open permits with coordinates
        const q = "SELECT PermitID, WorkType, Latitude, Longitude, ExactLocation, RequesterName, ValidTo FROM Permits WHERE Status NOT IN ('Closed') AND Latitude IS NOT NULL";
        const result = await pool.request().query(q);

        const markers = result.recordset.map(r => ({
            PermitID: r.PermitID,
            lat: parseFloat(r.Latitude),
            lng: parseFloat(r.Longitude),
            WorkType: r.WorkType,
            ExactLocation: r.ExactLocation,
            RequesterName: r.RequesterName,
            ValidTo: r.ValidTo
        }));

        context.res = { body: markers };
    } catch (e) {
        context.res = { status: 500, body: { error: e.message } };
    }
};

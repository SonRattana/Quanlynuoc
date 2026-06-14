const db = require("../db");

const logAction = async (req, action, entity_table, entity_id, old_data = null, new_data = null, description = "") => {
    try {

        console.log("DEBUG LOGGER - User Info:", req.user);
        // Đảm bảo các giá trị không bao giờ là undefined
        const user_id = req.user?.id || null; 
        const email = req.user?.email || null; 
        const ip_address = req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || 'unknown';

        const query = `
            INSERT INTO system_logs 
            (user_id, email, action, entity_table, entity_id, old_data, new_data, description, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            user_id,
            email,
            action || 'UNKNOWN',
            entity_table || null,
            entity_id || null,
            old_data ? JSON.stringify(old_data) : null,
            new_data ? JSON.stringify(new_data) : null,
            description || '',
            ip_address
        ];

        await db.execute(query, values);
        
    } catch (error) {
        console.error("🔥 Lỗi System Log:", error);
    }
};

module.exports = { logAction };
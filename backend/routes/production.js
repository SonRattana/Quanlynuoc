const router = require("express").Router();
const db = require("../db");
const { verifyToken } = require("../middleware/authMiddleware");

// 1. Lấy danh sách Thành Phẩm
router.get("/finished-goods", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT id, name, unit, quantity, cost_price 
            FROM products 
            WHERE is_active = 1 AND item_type = 'thanh_pham'
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải danh sách thành phẩm" });
    }
});

// ================= 2. LỆNH SẢN XUẤT - BĂM CHI PHÍ VẬN HÀNH VÀO GIÁ VỐN =================
router.post("/", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { product_id, quantity, materials, note } = req.body;
        const prodQty = Number(quantity);

        if (!product_id || prodQty <= 0 || !materials || materials.length === 0) {
            return res.status(400).json({ message: "Dữ liệu không hợp lệ!" });
        }

        await connection.beginTransaction();

        // 💡 1. Tạo Lệnh SX trước để lấy poId
        const [poResult] = await connection.query(
            `INSERT INTO production_orders (product_id, quantity, total_cost, unit_cost, note, cost_status) 
             VALUES (?, ?, 0, 0, ?, 'TEMP')`,
            [product_id, prodQty, note || ""]
        );
        const poId = poResult.insertId;

        const bomList = materials.map(m => ({
            material_id: m.material_id,
            quantity: Number(m.required_qty) / prodQty
        }));

        let totalMaterialCost = 0;
        let productionDetails = [];

        for (const bom of bomList) {
            let requiredQty = bom.quantity * prodQty;

            // 💡 2. Tự động tìm kho có đủ hàng cho NVL này
            const [warehouseItems] = await connection.query(
                `SELECT warehouse_id FROM warehouse_products 
                 WHERE product_id = ? AND quantity >= ? LIMIT 1`,
                [bom.material_id, requiredQty]
            );

            // Nếu không tìm thấy kho nào đủ, mặc định kho 2 hoặc báo lỗi
            const targetWarehouseId = warehouseItems.length > 0 ? warehouseItems[0].warehouse_id : 2;

            // 3. FIFO
            const [batches] = await connection.query(
                `SELECT id, quantity_remaining, cost_price FROM inventory_batches 
                 WHERE product_id = ? AND quantity_remaining > 0 
                 ORDER BY created_at ASC FOR UPDATE`, [bom.material_id]
            );

            let remainingToFulfill = requiredQty;
            for (const batch of batches) {
                if (remainingToFulfill <= 0) break;
                const takeQty = Math.min(batch.quantity_remaining, remainingToFulfill);
                totalMaterialCost += (takeQty * batch.cost_price);
                remainingToFulfill -= takeQty;

                productionDetails.push({ material_id: bom.material_id, batch_id: batch.id, quantity_used: takeQty, unit_cost: batch.cost_price, total_cost: takeQty * batch.cost_price });
                await connection.query(`UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?`, [takeQty, batch.id]);
            }

            // 4. Trừ kho (Dùng targetWarehouseId)
            await connection.query(`UPDATE products SET quantity = quantity - ? WHERE id = ?`, [requiredQty, bom.material_id]);
            await connection.query(`UPDATE warehouse_products SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?`, [requiredQty, targetWarehouseId, bom.material_id]);

            // 💡 5. Ghi Log NXT (Sử dụng đúng poId đã lấy ở trên)
            await connection.query(
                `INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason, transaction_type) 
                 VALUES (?, ?, 'export', ?, ?, 'production_export')`,
                [bom.material_id, targetWarehouseId, requiredQty, `Xuất NVL cho Lệnh SX #${poId}`]
            );
        }

        const unitCost = totalMaterialCost / prodQty;
        await connection.query(`UPDATE production_orders SET total_cost = ?, unit_cost = ? WHERE id = ?`, [totalMaterialCost, unitCost, poId]);

        // Cập nhật thành phẩm
        await connection.query(`UPDATE products SET quantity = quantity + ? WHERE id = ?`, [prodQty, product_id]);
        await connection.query("INSERT INTO warehouse_products (warehouse_id, product_id, quantity) VALUES (2, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?", [product_id, prodQty, prodQty]);
        await connection.query(`INSERT INTO stock_transactions (product_id, warehouse_id, type, quantity, reason, transaction_type) VALUES (?, 2, 'import', ?, 'Sản xuất', 'manual_import')`, [product_id, prodQty]);

        // Lưu lô & Chi tiết vật tư
        await connection.query(`INSERT INTO inventory_batches (product_id, quantity_remaining, cost_price, production_order_id, created_at) VALUES (?, ?, ?, ?, NOW())`, [product_id, prodQty, unitCost, poId]);

        for (const detail of productionDetails) {
            await connection.query(
                `INSERT INTO production_order_details (production_order_id, material_id, batch_id, quantity_used, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?)`,
                [poId, detail.material_id, detail.batch_id, detail.quantity_used, detail.unit_cost, detail.total_cost]
            );
        }

        await connection.commit();
        res.json({ message: "Sản xuất thành công!", produced_qty: prodQty, unit_cost: unitCost });

    } catch (err) {
        await connection.rollback();
        console.error("LỖI SẢN XUẤT:", err);
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

router.get("/history", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT po.id, p.name AS product_name, po.quantity, po.total_cost, po.unit_cost, po.created_at, po.note
            FROM production_orders po JOIN products p ON po.product_id = p.id ORDER BY po.id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải lịch sử" });
    }
});

router.get("/history/:id/details", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT pod.id, p.name AS material_name, p.unit, pod.quantity_used, pod.unit_cost, pod.total_cost, pod.batch_id
            FROM production_order_details pod JOIN products p ON pod.material_id = p.id WHERE pod.production_order_id = ?
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
});

router.get("/preview-bom/:productId", verifyToken, async (req, res) => {
    try {
        const qty = Number(req.query.qty) || 0;
        if (qty <= 0) return res.json([]);
        const [rows] = await db.query(`
            SELECT pb.material_id, p.name AS material_name, p.unit, p.quantity AS current_stock, (pb.quantity * ?) AS required_qty
            FROM product_bom pb JOIN products p ON pb.material_id = p.id WHERE pb.product_id = ?
        `, [qty, req.params.productId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
});

// ================= 4. QUẢN LÝ ĐỊNH MỨC CHI PHÍ (GIAO DIỆN PHƯƠNG ÁN 2) =================

// 4.1. API Lấy danh sách thành phẩm kèm định mức lương/khấu hao hiện tại
router.get("/cost-configs", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.id, p.name, p.unit, 
                   IFNULL(c.labor_cost, 0) as labor_cost, 
                   IFNULL(c.depreciation_cost, 0) as depreciation_cost
            FROM products p
            LEFT JOIN production_cost_configs c ON p.id = c.product_id
            WHERE p.is_active = 1 AND p.item_type = 'thanh_pham'
        `);
        res.json(rows);
    } catch (err) {
        console.error("Lỗi lấy định mức chi phí:", err);
        res.status(500).json({ message: "Lỗi tải cấu hình định mức chi phí" });
    }
});

// 4.2. API Lưu hoặc Cập nhật định mức chi phí cho từng sản phẩm
router.post("/cost-configs", verifyToken, async (req, res) => {
    try {
        const { product_id, labor_cost, depreciation_cost } = req.body;

        if (!product_id) {
            return res.status(400).json({ message: "Thiếu mã sản phẩm!" });
        }

        await db.query(`
            INSERT INTO production_cost_configs (product_id, labor_cost, depreciation_cost)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                labor_cost = VALUES(labor_cost), 
                depreciation_cost = VALUES(depreciation_cost)
        `, [product_id, labor_cost || 0, depreciation_cost || 0]);

        res.json({ message: "Cập nhật định mức thành công!" });
    } catch (err) {
        console.error("Lỗi lưu định mức:", err);
        res.status(500).json({ message: "Lỗi hệ thống khi lưu định mức" });
    }
});

// ================= API: CHỐT GIÁ VỐN THEO KỲ (TUẦN / THÁNG) =================
router.post("/monthly-costing", verifyToken, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { start_date, end_date, total_electric_water, total_labor, total_depreciation } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: "Vui lòng chọn khoảng thời gian chốt sổ!" });
        }

        await connection.beginTransaction();

        const totalOverhead = Number(total_electric_water) + Number(total_labor) + Number(total_depreciation);

        // 💡 BƯỚC NGOẶT: Lấy trực tiếp Dữ liệu từ Lệnh Sản Xuất (production_orders)
        const [prodStats] = await connection.query(`
            SELECT 
                po.product_id, 
                SUM(po.quantity) as total_produced,
                SUM(po.total_cost) as total_material_cost,
                p.volume
            FROM production_orders po
            JOIN products p ON po.product_id = p.id
            WHERE DATE(po.created_at) BETWEEN ? AND ?
            GROUP BY po.product_id
        `, [start_date, end_date]);

        if (prodStats.length === 0) {
            throw new Error("Trong giai đoạn này không có lệnh sản xuất nào để chốt sổ!");
        }

        // Tính tổng dung tích để chia chi phí
        const totalVolumeProduced = prodStats.reduce((sum, stat) => {
            const vol = Number(stat.volume) || 1;
            return sum + (Number(stat.total_produced) * vol);
        }, 0);

        const overheadPerMl = totalVolumeProduced > 0 ? (totalOverhead / totalVolumeProduced) : 0;

        // Lưu lịch sử Chốt kỳ
        const [monthlyRes] = await connection.query(
            `INSERT INTO monthly_costings (month, year, start_date, end_date, total_electric_water, total_labor, total_depreciation, created_by) 
             VALUES (MONTH(?), YEAR(?), ?, ?, ?, ?, ?, ?)`,
            [start_date, start_date, start_date, end_date, total_electric_water, total_labor, total_depreciation, req.user.id]
        );
        const costingId = monthlyRes.insertId;

        // Xử lý từng sản phẩm
        for (const stat of prodStats) {
            const vol = Number(stat.volume) || 1;
            const unitOverhead = overheadPerMl * vol;

            // 💡 GIÁ VỐN GỐC = Tổng tiền NVL đã tiêu hao / Tổng sản lượng (Đảm bảo lấy chuẩn 36.000đ)
            const baseMaterialCost = Number(stat.total_material_cost) / Number(stat.total_produced);

            // Giá vốn cuối cùng
            const finalUnitCost = baseMaterialCost + unitOverhead;

            await connection.query(
                `INSERT INTO monthly_costing_details (monthly_costing_id, product_id, total_produced, unit_cost) VALUES (?, ?, ?, ?)`,
                [costingId, stat.product_id, stat.total_produced, finalUnitCost]
            );

            // Cập nhật giá vốn mới cho các hóa đơn trong kỳ
            await connection.query(
                `UPDATE invoice_items ii
                 JOIN invoices i ON ii.invoice_id = i.id
                 SET ii.cost_price = ?
                 WHERE ii.product_id = ? 
                   AND DATE(i.created_at) BETWEEN ? AND ?`,
                [finalUnitCost, stat.product_id, start_date, end_date]
            );

            // Cập nhật giá vốn trong bảng products (hiển thị ra ngoài danh sách)
            await connection.query("UPDATE products SET cost_price = ? WHERE id = ?", [finalUnitCost, stat.product_id]);

            // 💡 Cập nhật Lệnh Sản Xuất từ 'TEMP' (Tạm tính) sang 'FINAL' (Đã chốt) và lưu lại giá vốn cuối cùng
            await connection.query(
                `UPDATE production_orders 
                 SET cost_status = 'FINAL', unit_cost = ? 
                 WHERE product_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
                [finalUnitCost, stat.product_id, start_date, end_date]
            );
        }

        // Cập nhật lại tổng lợi nhuận của toàn bộ hóa đơn
        await connection.query(
            `UPDATE invoices i
             SET i.total_profit = (
                 SELECT SUM((sell_price - cost_price) * quantity) 
                 FROM invoice_items 
                 WHERE invoice_id = i.id
             )
             WHERE DATE(i.created_at) BETWEEN ? AND ?`,
            [start_date, end_date]
        );

        await connection.commit();
        res.json({ message: "Chốt sổ kỳ thành công! Giá vốn đã được chia chuẩn xác theo Lệnh Sản Xuất." });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;
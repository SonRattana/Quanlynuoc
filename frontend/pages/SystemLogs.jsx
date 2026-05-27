import React, { useState, useEffect } from "react";
import Layout from "../components/Layout"
import Pagination from "../components/Pagination";
import Toast from "../components/Toast";

import api from "../src/utils/axios";

function SystemLogs() {
    const [logs, setLogs] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [toast, setToast] = useState(null);
    
    // State để mở Modal xem chi tiết JSON
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = async () => {
        try {
            const res = await api.get(`api/logs?page=${page}&limit=15`);
            setLogs(res.data.data || []);
            setTotalPages(res.data.totalPages || 1);
        } catch (error) {
            setToast({ 
                message: error.response?.data?.message || "Lỗi tải nhật ký hệ thống", 
                type: "danger" 
            });
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page]);

    // Hàm định dạng ngày giờ cho đẹp
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <Layout>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="container-fluid pt-4 px-4">
                <div className="bg-white shadow-sm p-4 rounded">
                    <h4 className="fw-bold mb-4 text-danger"><i className="fa fa-user-secret me-2"></i>Nhật ký hệ thống (Audit Logs)</h4>
                    
                    <div className="table-responsive">
                        <table className="table table-hover align-middle table-bordered">
                            <thead className="table-dark">
                                <tr>
                                    <th>Thời gian</th>
                                    <th>User ID</th>
                                    <th>Email</th>
                                    <th>Hành động</th>
                                    <th>Bảng</th>
                                    <th>Mô tả</th>
                                    <th>IP Address</th>
                                    <th className="text-center">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length > 0 ? logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="text-nowrap">{formatDate(log.created_at)}</td>
                                        <td>{log.user_id || "Khách"}</td>
                                        <td>{log.email || "N/A"}</td>
                                        <td>
                                            <span className={`badge ${log.action.includes('DELETE') ? 'bg-danger' : log.action.includes('UPDATE') ? 'bg-warning text-dark' : 'bg-success'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td><code>{log.entity_table}</code></td>
                                        <td>{log.description}</td>
                                        <td>{log.ip_address}</td>
                                        <td className="text-center">
                                            <button 
                                                className="btn btn-sm btn-outline-info"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <i className="fa fa-eye"></i> Xem
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="8" className="text-center py-4">Chưa có dữ liệu nhật ký.</td></tr>
                                )}
                            </tbody>
                        </table>
                        
                        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
                    </div>
                </div>
            </div>

            {/* MODAL XEM CHI TIẾT DỮ LIỆU CŨ/MỚI */}
            {selectedLog && (
                <>
                    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-lg modal-dialog-scrollable">
                            <div className="modal-content">
                                <div className="modal-header bg-info text-white">
                                    <h5 className="modal-title fw-bold">Chi tiết thay đổi (ID: {selectedLog.id})</h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLog(null)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <h6 className="fw-bold text-danger">Dữ liệu CŨ (old_data)</h6>
                                            <pre className="bg-light p-3 border rounded" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                                                {selectedLog.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : "Không có dữ liệu"}
                                            </pre>
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <h6 className="fw-bold text-success">Dữ liệu MỚI (new_data)</h6>
                                            <pre className="bg-light p-3 border rounded" style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                                                {selectedLog.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : "Không có dữ liệu"}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>Đóng</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}

export default SystemLogs;
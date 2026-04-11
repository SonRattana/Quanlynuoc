import React from "react";

export default function Pagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null; // Chỉ 1 trang thì khỏi hiện thanh phân trang

  return (
    <div className="d-flex justify-content-center mt-4">
      <nav>
        <ul className="pagination mb-0">
          {/* Nút Trước (<<) */}
          <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPage(page - 1)}>
              &laquo;
            </button>
          </li>

          {(() => {
            const pages = [];
            const maxVisible = 5;

            let start = Math.max(1, page - 2);
            let end = Math.min(totalPages, page + 2);

            if (page <= 3) {
              start = 1;
              end = Math.min(totalPages, maxVisible);
            }

            if (page > totalPages - 3) {
              start = Math.max(1, totalPages - maxVisible + 1);
              end = totalPages;
            }

            // Trang Đầu + ...
            if (start > 1) {
              pages.push(
                <li key={1} className="page-item">
                  <button className="page-link" onClick={() => setPage(1)}>1</button>
                </li>
              );
              if (start > 2) {
                pages.push(
                  <li key="start-ellipsis" className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                );
              }
            }

            // Các trang chính giữa
            for (let i = start; i <= end; i++) {
              pages.push(
                <li key={i} className={`page-item ${page === i ? "active" : ""}`}>
                  <button className="page-link" onClick={() => setPage(i)}>{i}</button>
                </li>
              );
            }

            // ... + Trang Cuối
            if (end < totalPages) {
              if (end < totalPages - 1) {
                pages.push(
                  <li key="end-ellipsis" className="page-item disabled">
                    <span className="page-link">...</span>
                  </li>
                );
              }
              pages.push(
                <li key={totalPages} className="page-item">
                  <button className="page-link" onClick={() => setPage(totalPages)}>{totalPages}</button>
                </li>
              );
            }

            return pages;
          })()}

          {/* Nút Sau (>>) */}
          <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPage(page + 1)}>
              &raquo;
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
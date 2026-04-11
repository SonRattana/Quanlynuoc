import { useEffect } from "react";
import React from "react";

export default function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`position-fixed top-0 end-0 p-3`}
      style={{ zIndex: 9999 }}
    >
      <div
        className={`toast show align-items-center text-white ${type === "error" ? "bg-danger" : "bg-success"
          } border-0`}
      >
        <div className="d-flex">
          <div className="toast-body">
            {message}
          </div>
          <button
            type="button"
            className="btn-close btn-close-white me-2 m-auto"
            onClick={onClose}
          ></button>
        </div>
      </div>
    </div>
  );
}
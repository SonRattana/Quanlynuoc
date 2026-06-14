// file: frontend/src/utils/moneyFormat.js

export const formatMoneyRounded = (val) => {
    return new Intl.NumberFormat("vi-VN", { 
        style: "currency", 
        currency: "VND",
        maximumFractionDigits: 0 
    }).format(Math.round(val || 0));
};

export const formatMoneyExact = (val) => {
    return new Intl.NumberFormat("vi-VN", { 
        style: "currency", 
        currency: "VND" 
    }).format(val || 0);
};

// Sếp dùng formatMoney làm mặc định (cho các chỗ không muốn sửa nhiều)
export const formatMoney = formatMoneyRounded;
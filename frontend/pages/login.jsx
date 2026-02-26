import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Login form submitted", { username, password });
    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      console.log("Login success:", data);

      // lưu token
      localStorage.setItem("token", data.token);
      localStorage.setItem("users", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-50 bg-light  p-4 p-sm-5 my-4 mx-3">
      <div className="bg-white rounded  p-4 p-sm-5 my-4 mx-3 shadow mx-auto" style={{ maxWidth: "800px" }}>
        <div className="text-center mb-4">
          <h2 className="text-primary fw-bold">QUẢN LÝ NƯỚC</h2>
          <h5>Đăng nhập</h5>
        </div>

        <div className="form-floating mb-3">
          <input type="text" className="form-control" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label>Tên đăng nhập</label>
        </div>

        <div className="form-floating mb-3">
          <input type="password" className="form-control" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Mật khẩu</label>
        </div>

        <button className="btn btn-primary w-100" onClick={handleLogin} >Đăng nhập</button>
      </div>
    </div>
  );
}
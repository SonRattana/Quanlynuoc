import Sidebar from "./sidebar";

function Layout({ children }) {
  return (
    <div className="d-flex">
      <Sidebar />

      <div className="content flex-grow-1 p-4">
        {children}
      </div>
    </div>
  );
}

export default Layout;
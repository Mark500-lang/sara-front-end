import { useState } from "react";

const LogoutButton = ({ onLogout }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      {/* Logout Button */}
      <button
        className="btn btn-danger"
        onClick={() => setShowModal(true)}
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: 1000,
        }}
      >
        Logout
      </button>

      {/* Styled Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            background: "rgba(0,0,0,0.5)",
          }}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog" role="document">
            <div
              className="modal-content"
              style={{
                background: "linear-gradient(to bottom, #272861, #2D3B79)",
                color: "white",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <div className="modal-body">
                <p>Are you sure you want to log out?</p>
              </div>
              <div className="modal-footer" style={{ borderTop: "none" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  style={{
                    backgroundColor: "#6c757d",
                    borderRadius: "5px",
                    padding: "10px 15px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={onLogout}
                  style={{
                    backgroundColor: "#dc3545",
                    borderRadius: "5px",
                    padding: "10px 15px",
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogoutButton;

import { useLocation, useNavigate } from "react-router-dom";
import { useRequests } from "../RequestsContext";
import Icon from "./Icon";
import { rupees } from "../format";

const MAX_VISIBLE = 3;

export default function RequestToasts() {
  const { toasts, dismissToast } = useRequests();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // the Requests page already shows these as cards
  if (pathname === "/admin/requests" || toasts.length === 0) return null;

  const shown = toasts.slice(0, MAX_VISIBLE);
  const extra = toasts.length - shown.length;

  function review(id) {
    dismissToast(id);
    navigate("/admin/requests");
  }

  return (
    <div className="toasts" role="region" aria-live="polite" aria-label="Payment requests">
      {shown.map((t) => (
        <div className="toast" key={t._id}>
          <span className="toast-icon">
            <Icon name="bell" size={20} />
          </span>
          <div className="toast-body">
            <strong>New payment request</strong>
            <span>
              {t.customerName} · {rupees(t.price)}
            </span>
            <span className="note">
              {t.paymentMethod === "upi"
                ? `UPI reference ${t.upiReference}`
                : "At the counter, taking cash"}
              {t.urgent ? " · URGENT" : ""}
            </span>
            <div className="actions">
              <button type="button" className="small" onClick={() => review(t._id)}>
                Review
              </button>
              <button type="button" className="small ghost" onClick={() => dismissToast(t._id)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
      {extra > 0 && (
        <div className="toast-more">
          +{extra} more waiting.{" "}
          <button type="button" className="linklike" onClick={() => navigate("/admin/requests")}>
            Open Requests
          </button>
        </div>
      )}
    </div>
  );
}
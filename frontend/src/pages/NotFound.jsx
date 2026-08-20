import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="view active lp-root" id="v-not-found">
            <div className="nf-box">
                <div className="nf-404">404</div>
                <div className="nf-title">Looks like you're lost.</div>
                <div className="nf-desc">The page you are looking for does not exist, has been removed, or is temporarily unavailable.</div>
                <Link to="/teacher/login" className="nf-btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back to portal
                </Link>
            </div>
        </div>
    );
}

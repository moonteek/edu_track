import { useState } from 'react';
import Navbar from '../components/Navbar';
import AdminOverview from './AdminOverview';
import AdminGroups from './AdminGroups';
import AdminTeachers from './AdminTeachers';
import AdminSchedule from './AdminSchedule';
import AdminAdmins from './AdminAdmins';
import NotificationBell from '../components/NotificationBanner';

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'groups', label: 'All Groups' },
    { key: 'teachers', label: 'Teachers' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'admins', label: 'Admins' },
];

export default function AdminApp({ token, onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <div className="view active" id="v-admin-app">
            <Navbar
                onLogout={onLogout}
                user={{ avatar: 'A', name: 'Administrator', role: 'Admin Panel' }}
                tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}
                rightSlot={
                    <NotificationBell
                        token={token}
                        onGoToGroups={() => setActiveTab('groups')}
                    />
                }
            />
            <div style={{ flex: 1 }}>
                {activeTab === 'overview' && (
                    <div className="panel active" id="apanel-overview">
                        <div className="panel-header">
                            <div className="panel-title">ADMIN <span className="y">OVERVIEW</span></div>
                            <div className="panel-subtitle">Platform-wide statistics and summary</div>
                        </div>
                        <AdminOverview token={token} onLogout={onLogout} />
                    </div>
                )}
                {activeTab === 'groups' && (
                    <div className="panel active" id="apanel-groups">
                        <div className="panel-header">
                            <div className="panel-title">ALL <span className="y">GROUPS</span></div>
                            <div className="panel-subtitle">Filter and browse every group across all teachers</div>
                        </div>
                        <AdminGroups token={token} onLogout={onLogout} />
                    </div>
                )}
                {activeTab === 'teachers' && (
                    <div className="panel active" id="apanel-teachers">
                        <div className="panel-header">
                            <div className="panel-title">TEACHER <span className="y">PROFILES</span></div>
                            <div className="panel-subtitle">Create, manage teacher accounts and view their groups</div>
                        </div>
                        <AdminTeachers token={token} onLogout={onLogout} />
                    </div>
                )}
                {activeTab === 'schedule' && (
                    <div className="panel active" id="apanel-schedule">
                        <div className="panel-header">
                            <div className="panel-title">TEACHER <span className="y">SCHEDULE</span></div>
                            <div className="panel-subtitle">Comprehensive overview of all teachers' availability and lessons</div>
                        </div>
                        <AdminSchedule token={token} onLogout={onLogout} />
                    </div>
                )}
                {activeTab === 'admins' && (
                    <div className="panel active" id="apanel-admins">
                        <div className="panel-header">
                            <div className="panel-title">SYSTEM <span className="y">ADMINISTRATORS</span></div>
                            <div className="panel-subtitle">Manage administrative access accounts and database-backed users</div>
                        </div>
                        <AdminAdmins token={token} onLogout={onLogout} />
                    </div>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Skeleton from '../components/Skeleton';

// ─── Lightweight XLSX builder (no library required) ──────────────────────────
function buildXlsx(sheets) {
    // sheets: [{ name, rows: [[cell,...], ...] }]
    // Generates a valid .xlsx (Office Open XML) Blob entirely in JS
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const sharedStrings = [];
    const ssMap = {};
    function si(val) {
        const s = String(val ?? '');
        if (s in ssMap) return ssMap[s];
        const idx = sharedStrings.length;
        sharedStrings.push(s);
        ssMap[s] = idx;
        return idx;
    }

    const colLetters = (n) => {
        let s = '';
        while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
        return s;
    };

    const sheetXmls = sheets.map(({ name, rows }) => {
        let xml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
        rows.forEach((row, ri) => {
            xml += `<row r="${ri + 1}">`;
            row.forEach((cell, ci) => {
                const ref = `${colLetters(ci)}${ri + 1}`;
                const idx = si(cell);
                xml += `<c r="${ref}" t="s"><v>${idx}</v></c>`;
            });
            xml += `</row>`;
        });
        xml += `</sheetData></worksheet>`;
        return { name: esc(name), xml };
    });

    const ssXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`;

    const wbXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetXmls.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`).join('')}</sheets></workbook>`;

    const wbRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>${sheetXmls.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;

    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${sheetXmls.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;

    const pkgRels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

    // Build ZIP manually (local file method – stored, no compression)
    function strToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c < 128) bytes.push(c);
            else if (c < 2048) { bytes.push(0xC0 | (c >> 6)); bytes.push(0x80 | (c & 63)); }
            else { bytes.push(0xE0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 63)); bytes.push(0x80 | (c & 63)); }
        }
        return new Uint8Array(bytes);
    }

    function crc32(data) {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[i] = c;
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
    function u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }

    const entries = [
        { name: '[Content_Types].xml', data: strToBytes(contentTypes) },
        { name: '_rels/.rels', data: strToBytes(pkgRels) },
        { name: 'xl/workbook.xml', data: strToBytes(wbXml) },
        { name: 'xl/_rels/workbook.xml.rels', data: strToBytes(wbRels) },
        { name: 'xl/sharedStrings.xml', data: strToBytes(ssXml) },
        ...sheetXmls.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: strToBytes(s.xml) })),
    ];

    const parts = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
        const name = strToBytes(entry.name);
        const crc = crc32(entry.data);
        const size = entry.data.length;
        const local = new Uint8Array([
            0x50, 0x4B, 0x03, 0x04, 20, 0, 0, 0, 0, 0,
            0, 0, 0, 0, ...u32(crc), ...u32(size), ...u32(size),
            ...u16(name.length), 0, 0, ...name, ...entry.data,
        ]);
        const cent = new Uint8Array([
            0x50, 0x4B, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0,
            0, 0, 0, 0, ...u32(crc), ...u32(size), ...u32(size),
            ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset), ...name,
        ]);
        parts.push(local);
        central.push(cent);
        offset += local.length;
    }

    const centralSize = central.reduce((a, b) => a + b.length, 0);
    const eocd = new Uint8Array([
        0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0,
        ...u16(entries.length), ...u16(entries.length),
        ...u32(centralSize), ...u32(offset), 0, 0,
    ]);

    const all = [...parts, ...central, eocd];
    const total = all.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const part of all) { out.set(part, pos); pos += part.length; }

    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminSchedule({ token }) {
    const [teachers, setTeachers] = useState(null);
    const [groups, setGroups] = useState(null);
    const [filterSubject, setFilterSubject] = useState('All');
    const [dayView, setDayView] = useState('odd'); // 'odd' or 'even'
    const showToast = useToast();

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setTeachers(null); setGroups(null);
            const [t, g] = await Promise.all([
                api('GET', '/api/teachers', null, token),
                api('GET', '/api/groups', null, token),
            ]);
            setTeachers(t);
            setGroups(g);
        } catch (err) {
            setTeachers([]); setGroups([]);
            showToast(err.message, true);
        }
    }

    const { groupedTeachers, allSubjects } = useMemo(() => {
        if (!teachers || !groups) return { groupedTeachers: {}, allSubjects: [] };

        const bySubject = {};
        teachers.forEach(teacher => {
            const subs = Array.isArray(teacher.subject) ? teacher.subject : [teacher.subject];
            const primary = subs[0] || 'Uncategorized';
            if (!bySubject[primary]) bySubject[primary] = [];
            bySubject[primary].push(teacher);
        });

        const subjectKeys = Object.keys(bySubject).sort();
        return { groupedTeachers: bySubject, allSubjects: subjectKeys };
    }, [teachers, groups]);

    function generateSlots(isStrictlyItKids) {
        const slots = [];
        let currentMin = 8 * 60;
        const intervalMin = isStrictlyItKids ? 90 : 120;

        while (currentMin + intervalMin <= 20 * 60) {
            const h1 = String(Math.floor(currentMin / 60)).padStart(2, '0');
            const m1 = String(currentMin % 60).padStart(2, '0');
            const nextMin = currentMin + intervalMin;
            const h2 = String(Math.floor(nextMin / 60)).padStart(2, '0');
            const m2 = String(nextMin % 60).padStart(2, '0');
            slots.push(`${h1}:${m1}-${h2}:${m2}`);
            currentMin = nextMin;
        }

        return slots.filter(s => {
            const startH = parseInt(s.split(':')[0]);
            return startH !== 12 && startH !== 13;
        });
    }

    const isOverlapping = (slotStr, gStart, gEnd) => {
        if (!gStart || !gEnd) return false;
        const [s1, e1] = slotStr.split('-');
        const toMins = t => { const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
        return toMins(s1) < toMins(gEnd) && toMins(gStart) < toMins(e1);
    };

    // ── Excel Export ──────────────────────────────────────────────────────────
    function handleDownloadExcel() {
        if (!teachers || !groups) return;
        const dayLabel = dayView === 'odd' ? 'Odd Days (Mon, Wed, Fri)' : 'Even Days (Tue, Thu, Sat)';
        const sheets = [];

        // One sheet per specialization (filtered by current view subject if set)
        const subjectsToExport = filterSubject === 'All' ? allSubjects : [filterSubject];

        for (const subject of subjectsToExport) {
            const subjTeachers = groupedTeachers[subject] || [];
            if (!subjTeachers.length) continue;

            // Collect all unique slots across all teachers in this subject
            const allSlots = [...new Set(
                subjTeachers.flatMap(t => {
                    const subs = Array.isArray(t.subject) ? t.subject : [t.subject];
                    return generateSlots(subs.every(s => s === 'IT Kids'));
                })
            )].sort();

            // Header row
            const header = ['Teacher', 'Groups Total', ...allSlots];
            const rows = [
                [`${subject} — ${dayLabel}`],
                header,
            ];

            for (const t of subjTeachers) {
                const tGroups = groups.filter(g => g.tid === t.id);
                const targetGroups = tGroups.filter(g =>
                    g.days === (dayView === 'odd' ? 'Odd Days' : 'Even Days') || g.days === 'Every Day'
                );
                const avail = t.availability || { oddDays: {}, evenDays: {} };
                const dayKey = dayView === 'odd' ? 'oddDays' : 'evenDays';

                const slotCells = allSlots.map(slot => {
                    const hasLesson = targetGroups.some(g => isOverlapping(slot, g.startTime, g.endTime));
                    if (hasLesson) {
                        const grp = targetGroups.find(g => isOverlapping(slot, g.startTime, g.endTime));
                        return grp ? `Lesson: ${grp.group}` : 'Lesson';
                    }
                    return avail[dayKey]?.[slot] || 'Unset';
                });

                rows.push([t.name, String(tGroups.length), ...slotCells]);
            }

            // Sheet name max 31 chars (Excel limit)
            const sheetName = subject.length > 28 ? subject.slice(0, 28) + '...' : subject;
            sheets.push({ name: sheetName, rows });
        }

        if (!sheets.length) {
            showToast('No data to export', true);
            return;
        }

        const blob = buildXlsx(sheets);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        const dayTag = dayView === 'odd' ? 'OddDays' : 'EvenDays';
        a.download = `EduTrack_Schedule_${dayTag}_${date}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Schedule exported to Excel successfully');
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!teachers || !groups) {
        return <div className="panel-body"><Skeleton /></div>;
    }

    const displayedSubjects = filterSubject === 'All' ? allSubjects : allSubjects.filter(s => s === filterSubject);

    return (
        <div className="panel-body">
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--gray)', fontSize: '14px', fontWeight: 500 }}>Filter:</span>
                    <select
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#121212',
                            border: '1px solid var(--border)',
                            color: '#ffffff',
                            fontSize: '14px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="All">All Specializations</option>
                        {allSubjects.map(subj => (
                            <option key={subj} value={subj}>{subj}</option>
                        ))}
                    </select>

                    {/* ── Download Button ── */}
                    <button
                        onClick={handleDownloadExcel}
                        title={`Download ${filterSubject === 'All' ? 'all' : filterSubject} schedule as Excel`}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: '8px',
                            background: 'rgba(76,175,80,0.12)',
                            border: '1px solid rgba(76,175,80,0.3)',
                            color: 'var(--green)',
                            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--fm)',
                            cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(76,175,80,0.22)'; e.currentTarget.style.borderColor = 'rgba(76,175,80,0.55)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(76,175,80,0.12)'; e.currentTarget.style.borderColor = 'rgba(76,175,80,0.3)'; }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export Excel
                    </button>
                </div>

                <div style={{ display: 'flex', background: 'var(--darker)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px' }}>
                    <button
                        onClick={() => setDayView('odd')}
                        style={{
                            padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                            background: dayView === 'odd' ? 'var(--primary)' : 'transparent',
                            color: dayView === 'odd' ? '#fff' : 'var(--gray)', cursor: 'pointer', border: 'none'
                        }}
                    >ODD DAYS (Mon, Wed, Fri)</button>
                    <button
                        onClick={() => setDayView('even')}
                        style={{
                            padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
                            background: dayView === 'even' ? 'var(--primary)' : 'transparent',
                            color: dayView === 'even' ? '#fff' : 'var(--gray)', cursor: 'pointer', border: 'none'
                        }}
                    >EVEN DAYS (Tue, Thu, Sat)</button>
                </div>
            </div>

            {displayedSubjects.map((subject) => {
                const subjTeachers = groupedTeachers[subject] || [];
                return (
                    <div key={subject} style={{ marginBottom: '40px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--white)', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{subject}</span>
                            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--gray)', background: 'var(--darker)', padding: '4px 10px', borderRadius: '12px' }}>{subjTeachers.length} teachers</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {subjTeachers.map((t) => {
                                const tGroups = groups.filter(g => g.tid === t.id);
                                const subs = Array.isArray(t.subject) ? t.subject : [t.subject];
                                const strictlyItKids = subs.length > 0 && subs.every(s => s === 'IT Kids');
                                const tSlots = generateSlots(strictlyItKids);
                                const avail = t.availability || { oddDays: {}, evenDays: {} };

                                const targetGroups = tGroups.filter(g => g.days === (dayView === 'odd' ? 'Odd Days' : 'Even Days') || g.days === 'Every Day');

                                let freeSlotsCount = 0;
                                tSlots.forEach(slot => {
                                    if (!targetGroups.some(g => isOverlapping(slot, g.startTime, g.endTime)) && avail[dayView === 'odd' ? 'oddDays' : 'evenDays']?.[slot] === 'Free') {
                                        freeSlotsCount++;
                                    }
                                });

                                return (
                                    <div key={t.id} style={{ display: 'flex', background: 'var(--darker)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                                        {/* Left Side: Teacher Info */}
                                        <div style={{ padding: '12px 16px', minWidth: '220px', maxWidth: '220px', display: 'flex', alignItems: 'center', gap: '12px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                                            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #9c27b0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', fontWeight: 600, fontSize: '16px', flexShrink: 0 }}>
                                                {t.name.charAt(0)}
                                            </div>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--gray)', fontFamily: 'var(--fm)', display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                    <span>{tGroups.length} grps</span>
                                                    <span style={{ color: freeSlotsCount > 0 ? 'var(--green)' : 'inherit' }}>{freeSlotsCount} free</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Horizontal Timeline Blocks */}
                                        <div style={{ display: 'flex', flex: 1, padding: '8px', gap: '6px', overflowX: 'auto', alignItems: 'stretch' }}>
                                            {tSlots.map(slot => {
                                                const hasLesson = targetGroups.some(g => isOverlapping(slot, g.startTime, g.endTime));
                                                let status = avail[dayView === 'odd' ? 'oddDays' : 'evenDays']?.[slot] || 'Unset';

                                                const groupInSlot = hasLesson ? targetGroups.find(g => isOverlapping(slot, g.startTime, g.endTime)) : null;

                                                if (hasLesson) status = 'Lesson';

                                                let bg = 'rgba(255,255,255,0.03)', color = 'var(--gray)', badgeColor = 'rgba(255,255,255,0.1)';
                                                if (status === 'Lesson') { bg = 'rgba(244,67,54,0.08)'; color = 'var(--red)'; badgeColor = '#f44336'; }
                                                else if (status === 'Free') { bg = 'rgba(76,175,80,0.08)'; color = 'var(--green)'; badgeColor = '#4caf50'; }
                                                else if (status === 'Busy') { bg = 'rgba(255,152,0,0.08)'; color = '#ff9800'; badgeColor = '#ff9800'; }

                                                return (
                                                    <div key={slot} title={groupInSlot ? `Group: ${groupInSlot.group}` : status} style={{ flex: 1, minWidth: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, borderRadius: '6px', padding: '6px', border: '1px solid rgba(255,255,255,0.02)', position: 'relative', transition: 'all 0.2s', cursor: 'pointer' }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: badgeColor, position: 'absolute', top: '6px', right: '6px' }} />
                                                        <span style={{ fontSize: '11px', fontFamily: 'var(--fm)', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                                                            {slot.split('-')[0]}
                                                        </span>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%', textAlign: 'center' }}>
                                                            {hasLesson && groupInSlot ? groupInSlot.group : status}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {allSubjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray)' }}>No teachers active</div>
            )}
            {allSubjects.length > 0 && displayedSubjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--gray)' }}>No teachers found for this specialization</div>
            )}
        </div>
    );
}

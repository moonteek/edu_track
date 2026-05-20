import { PC, LPL, totalDone, totalLessons, pct, autoProgress } from '../constants';

export default function LevelBar({ group, mode = 'card' }) {
    const isAuto = group.autoProgress === true;
    const auto = isAuto ? autoProgress(group) : null;
    const currentLevel = isAuto ? auto.level : group.level;
    const currentDoneInLevel = isAuto ? auto.doneInLevel : group.doneInLevel;

    const cfg = PC[group.lang] || { levels: 1 };
    const lvls = cfg.levels;
    const done = totalDone(currentLevel, currentDoneInLevel);
    const tl = totalLessons(group.lang);
    const op = pct(done, tl);

    const segments = Array.from({ length: lvls }, (_, i) => {
        const lv = i + 1;
        const isDone = lv < currentLevel;
        const isCur = lv === currentLevel;
        const fw = isDone ? 100 : isCur ? Math.min(100, Math.round((currentDoneInLevel / LPL) * 100)) : 0;
        return { lv, isDone, isCur, fw };
    });

    if (mode === 'card') {
        return (
            <div className="level-bar-wrap">
                <div className="level-bar-title">
                    <span className="level-bar-label">Level Progress &nbsp;·&nbsp; {done}/{tl} lessons</span>
                    <span className="level-bar-pct">{op}%</span>
                </div>
                <div className="level-bar-track">
                    {segments.map((s) => (
                        <div key={s.lv} className={'level-seg' + (s.isCur ? ' level-seg-active' : '')}>
                            <div className={'level-seg-fill' + (s.isDone ? ' done' : '')} style={{ width: s.fw + '%' }}></div>
                            <div className={'level-seg-label ' + (s.fw >= 50 ? 'dark' : 'light')}>LV{s.lv}</div>
                        </div>
                    ))}
                </div>
                <div className="level-ticks">
                    {segments.map((s) => (
                        <div key={s.lv} className={'level-tick ' + (s.isDone ? 'done-tick' : s.isCur ? 'active-tick' : '')}>
                            Level {s.lv}<br />
                            <span style={{ fontSize: '8px', opacity: 0.6 }}>{(s.lv - 1) * LPL + 1}-{s.lv * LPL}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // mini / table mode
    return (
        <div className="mini-level-wrap">
            <div className="mini-level-bar">
                {segments.map((s) => (
                    <div key={s.lv} className={'mini-seg' + (s.isCur ? ' active-seg' : '')}>
                        <div className={'mini-seg-fill' + (s.isDone ? ' done' : '')} style={{ width: s.fw + '%' }}></div>
                    </div>
                ))}
            </div>
            <div className="mini-level-info">
                <span className="mini-level-pct">{op}%</span>
                <span className="mini-level-detail">Lv{currentLevel}/{lvls} &nbsp;·&nbsp; {currentDoneInLevel}/{LPL} this level</span>
            </div>
        </div>
    );
}

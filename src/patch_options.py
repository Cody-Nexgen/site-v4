from pathlib import Path
import re

p = Path('src/options/OptionsApp.tsx')
t = p.read_text(encoding='utf-8')

t = t.replace("navigateTab('tasks')", "navigateTab('calendar')")
t = t.replace("activeTab === 'tasks'", "activeTab === 'calendar'")
t = t.replace('IconChecklist size={14} />\n                                <span className="text-[13px] font-medium">Tasks</span>',
              'IconCalendarStats size={14} />\n                                <span className="text-[13px] font-medium">Calendar</span>')
t = t.replace('{engineState.currentStreak || 0}d', '{streak}d')
t = t.replace(
    'i < (engineState.currentStreak % 7 || (engineState.currentStreak > 0 ? 7 : 0))',
    'i < Math.min(streak, 7)',
)
t = t.replace('BEST : {engineState.bestStreak || 0} DAYS', 'BEST : {streak} DAYS')
t = t.replace('engineState.profilePicture', 'engineState.profileAvatar')

# Fix broken settings nav
t = t.replace(
    """                                <motion.div className="flex items-center space-x-2.5 ml-1">
                                    <IconBolt size={14} />
                            </div>
                        </nav>""",
    """                                <div className="flex items-center space-x-2.5 ml-1">
                                    <IconBolt size={14} />
                                    <span className="text-[13px] font-medium">Settings</span>
                                </div>
                            </motion.div>
                        </nav>""",
)

t = t.replace(
    'onClick={() => navigateTab(\'overview\')}\">\n                            <span>Workspace</span>',
    'onClick={() => setWorkspaceOpen(true)}\">\n                            <span>Workspace</span>',
)
t = t.replace(
    'onClick={() => navigateTab(\'sessions\')}\">\n                            <span>Focus</span>',
    'onClick={() => setWorkspaceOpen(true)}\">\n                            <span>{tabToGroup(activeTab).label}</span>',
)
t = t.replace(
    '{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}',
    '{tabLabel(activeTab)}',
)

# Remove pause / new session header actions
t = re.sub(
    r'\s*<div className="h-4 w-px bg-white/10"></motion.div>\s*<div className="flex items-center space-x-2">.*?</motion.div>\s*</motion.div>\s*</header>',
    '\n                </header>',
    t,
    count=1,
    flags=re.S,
)

# Add modals before final closing of OptionsApp return
if 'OptionsCommandPalette' not in t:
    insert = """
            <OptionsCommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onNavigate={navigateTab}
                onOpenAi={() => navigateTab('ai_coach')}
            />
            <WorkspaceNavigator
                open={workspaceOpen}
                onClose={() => setWorkspaceOpen(false)}
                activeTab={activeTab}
                onNavigate={navigateTab}
            />
"""
    t = t.replace('            {showEndSession &&', insert + '            {showEndSession &&')

# Streak container overflow
t = t.replace(
    '<motion.div className="mb-4 group cursor-default">',
    '<motion.div className="mb-4 group cursor-default overflow-hidden min-w-0">',
    1,
)
t = t.replace(
    '<motion.div className="flex space-x-1 mb-1">',
    '<motion.div className="flex gap-1 mb-1 min-w-0">',
    1,
)
t = t.replace(
    'className={`flex-1 h-3 rounded-[2px]',
    'className={`flex-1 min-w-0 max-w-[28px] h-3 rounded-[2px]',
    1,
)

p.write_text(t, encoding='utf-8')
print('ok')

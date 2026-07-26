import FocusRoomPanel from '../components/FocusRoomPanel';

export default function FocusRoomsTab() {
    return (
        <div className="space-y-6 animate-fade-in-up max-w-[720px] mx-auto pt-6 pb-20">
            <div>
                <p className="focuz-section-label mb-1">Social</p>
                <h1 className="text-3xl font-black text-white tracking-tight">Focuz Rooms</h1>
                <p className="text-sm text-neutral-500 mt-2">
                    Co-focus with voice and video on{' '}
                    <span className="text-sky-400 font-medium">focuznow.com/room</span> — like a Discord call for deep work.
                </p>
            </div>
            <FocusRoomPanel />
        </div>
    );
}

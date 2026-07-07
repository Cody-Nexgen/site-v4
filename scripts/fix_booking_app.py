from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "website/components/booking/BookingApp.tsx"
text = p.read_text(encoding="utf-8")

start = text.index("{selectedDay && selectedSlotLabel && step !== 'date'")
end = text.index("{step === 'details' &&", start)
replacement = """{step === 'schedule' && (
                        <div>
                            <BookingScheduler
                                link={link}
                                booked={booked}
                                selectedDay={selectedDay}
                                selectedStartMin={selectedStartMin}
                                onSelectDay={(day) => {
                                    setSelectedDay(day);
                                    setError('');
                                }}
                                onSelectTime={(min) => {
                                    setSelectedStartMin(min);
                                    setError('');
                                }}
                            />
                            <button
                                type="button"
                                disabled={!selectedDay || selectedStartMin == null}
                                onClick={() => setStep('details')}
                                className="mt-6 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    """
text = text[:start] + replacement + text[end:]
text = text.replace("onClick={() => setStep('time')}", "onClick={() => setStep('schedule')}")
text = text.replace("<ChevronLeft size={16} /> Change time", "<ChevronLeft size={16} /> Change date or time")
text = text.replace("{i < 2 &&", "{i < 1 &&")
p.write_text(text, encoding="utf-8")
print("fixed", p)

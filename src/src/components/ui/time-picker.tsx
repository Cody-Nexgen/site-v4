import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TimePickerProps {
    date?: Date
    setDate: (date: Date) => void
    className?: string
}

export function TimePicker({ date, setDate, className }: TimePickerProps) {
    const minuteRef = React.useRef<HTMLInputElement>(null)
    const hourRef = React.useRef<HTMLInputElement>(null)

    // Internal state for 12h format
    const [hours12, setHours12] = React.useState('12')
    const [minutes, setMinutes] = React.useState('00')
    const [period, setPeriod] = React.useState<'AM' | 'PM'>('PM')

    React.useEffect(() => {
        if (date) {
            const h = date.getHours()
            const m = date.getMinutes()
            const p = h >= 12 ? 'PM' : 'AM'
            const h12 = h % 12 || 12

            setHours12(h12.toString().padStart(2, '0'))
            setMinutes(m.toString().padStart(2, '0'))
            setPeriod(p)
        }
    }, [date])

    const updateDate = (h12: string, m: string, p: 'AM' | 'PM') => {
        const newDate = new Date(date || new Date())
        let h = parseInt(h12)
        if (p === 'PM' && h !== 12) h += 12
        if (p === 'AM' && h === 12) h = 0

        newDate.setHours(h)
        newDate.setMinutes(parseInt(m))
        setDate(newDate)
    }

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (!/^\d*$/.test(val)) return
        if (parseInt(val) > 12) return

        setHours12(val)
        if (val.length === 2) {
            updateDate(val, minutes, period)
            minuteRef.current?.focus()
        }
    }

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        if (!/^\d*$/.test(val)) return
        if (parseInt(val) > 59) return

        setMinutes(val)
        if (val.length === 2) {
            updateDate(hours12, val, period)
        }
    }

    const togglePeriod = () => {
        const newPeriod = period === 'AM' ? 'PM' : 'AM'
        setPeriod(newPeriod)
        updateDate(hours12, minutes, newPeriod)
    }

    return (
        <div className={cn("flex items-end gap-1", className)}>
            <div className="grid gap-1 text-center">
                <Label htmlFor="hours" className="text-[10px] text-zinc-500">Hr</Label>
                <Input
                    ref={hourRef}
                    id="hours"
                    className="w-[40px] h-8 text-center font-mono text-sm p-0 bg-zinc-900 border-zinc-800"
                    value={hours12}
                    onChange={handleHourChange}
                    maxLength={2}
                    placeholder="12"
                />
            </div>
            <span className="pb-1 text-lg text-zinc-600">:</span>
            <div className="grid gap-1 text-center">
                <Label htmlFor="minutes" className="text-[10px] text-zinc-500">Min</Label>
                <Input
                    ref={minuteRef}
                    id="minutes"
                    className="w-[40px] h-8 text-center font-mono text-sm p-0 bg-zinc-900 border-zinc-800"
                    value={minutes}
                    onChange={handleMinuteChange}
                    maxLength={2}
                    placeholder="00"
                />
            </div>
            <Button
                variant="outline"
                size="sm"
                className="h-8 w-10 px-0 ml-1 bg-zinc-900 border-zinc-800 text-xs font-medium"
                onClick={togglePeriod}
            >
                {period}
            </Button>
        </div>
    )
}

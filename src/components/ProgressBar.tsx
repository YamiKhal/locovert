import { cn } from "../lib/utils"

interface ProgressBarProps {
    progress: number
    className?: string
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
    const clamped = Math.max(0, Math.min(100, progress))
    return (
        <div
            className={cn(
                "h-1.5 w-full overflow-hidden rounded-full bg-(--surface-2)",
                className
            )}
            role="progressbar"
            aria-valuenow={Math.round(clamped)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className="h-full rounded-full bg-(--primary) transition-[width] duration-200 ease-out"
                style={{
                    width: `${clamped}%`,
                    backgroundImage:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 50%, transparent)",
                    backgroundSize: "32px 100%",
                    animation: "barShimmer 0.9s linear infinite",
                }}
            />
        </div>
    )
}

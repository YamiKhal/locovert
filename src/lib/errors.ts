export class AppError extends Error {
    constructor(message: string) {
        super(message)
        this.name = new.target.name
    }
}

export class ConversionFailedError extends AppError {
    constructor(reason: string) {
        super(`Conversion failed: ${reason}`)
    }
}

export class CancelledError extends AppError {
    constructor() {
        super("Conversion cancelled")
    }
}

interface IDebounceTimerArgs
{
	// every time this is called, delay timer by ms
	debounceMs: number,
	// if total delay time exceeds this number, trigger timer
	maxDebounceMs: number
}

export class DebounceTimer
{
	private debounceMs: number = 0;
	private maxDebounceMs: number = 0;
	private triggerDeadline: number = -1;
	private lastDebounce: number = -1;
	private isActive: boolean;
	private fn?: () => any;
	
	public constructor(args: IDebounceTimerArgs)
	{
		this.debounceMs = args.debounceMs;
		this.maxDebounceMs = args.maxDebounceMs;
		this.isActive = false;
	}

	private get nowMs(): number
	{
		return (new Date()).getTime();
	}

	public restart(fn: () => any): void
	{
		const now = this.nowMs;
		this.fn = fn;

		this.lastDebounce = now;
		if (!this.isActive)
		{
			this.triggerDeadline = now + this.maxDebounceMs;
			this.isActive = true;
		}
		this.doDebounce();
	}

	public stop(): void
	{
		this.isActive = false;
	}

	private doDebounce(): boolean
	{
		if (!this.isActive)
			return false;

		const now = this.nowMs;

		if (now > this.triggerDeadline)
		{
			this.trigger();
			return true;
		}

		const lastDebounce = this.lastDebounce;
		if ((now - lastDebounce) > this.debounceMs)
		{
			this.trigger();
			return true;
		}

		setTimeout(() => this.doDebounce(), this.debounceMs);
		return false;
	}

	private trigger(): void
	{
		this.fn && this.fn();
		delete this.fn;
		this.isActive = false;
	}
}


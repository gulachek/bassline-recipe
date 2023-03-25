import * as React from 'react';
import {
	useCallback,
	useRef,
	useEffect,
	FormEvent,
	PropsWithChildren
} from 'react';

import { DebounceTimer } from './debounceTimer';

interface IAutoSaveFormProps
{
	hasChange: boolean; // triggers save when true
	onSave(): void; // provide implementation to save
	debounceMs?: number; // wait at least this long after change introduced to save
	maxDebounceMs?: number; // after this much time passes just save
}

export function AutoSaveForm(props: PropsWithChildren<IAutoSaveFormProps>)
{
	const { debounceMs, maxDebounceMs, hasChange, onSave } = props;

	const timer = useRef(new DebounceTimer({
		debounceMs: debounceMs || 500,
		maxDebounceMs: maxDebounceMs || 5000
	}));

	const onSubmit = useCallback((e?: FormEvent) => {
		e?.preventDefault(); // onSave should do saving
		onSave();
	}, [onSave]);

	const formElem = useRef<HTMLFormElement>(null);

	useEffect(() => {
		window.removeEventListener('beforeunload', preventUnload);
		delete formElem.current.dataset.isBusy;

		if (hasChange)
		{
			timer.current.restart(() => onSave());
			window.addEventListener('beforeunload', preventUnload);
			formElem.current.dataset.isBusy = '';
		}
		else
		{
			timer.current.stop();
		}
	}); // debounce every render

	return <form ref={formElem} className="autosave" onSubmit={onSubmit}>
		<input type="submit" style={{display: 'none'}} />
		{props.children}
	</form>;
}

interface IPreventUnload
{
	preventDefault(): any;
	returnValue?: string;
}

function preventUnload(e: IPreventUnload): string
{
	e.preventDefault();
	return e.returnValue = '';
}


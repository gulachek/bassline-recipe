import * as React from 'react';
import {
	useReducer,
	createContext,
	useContext,
	useCallback,
	useRef,
	useState,
	ChangeEvent,
	MouseEvent,
	KeyboardEvent,
	DragEvent
} from 'react';

import { renderReactPage } from './renderReactPage';
import { postJson } from './postJson';
import { AutoSaveForm } from './autosave/AutoSaveForm';

import './recipeEdit.scss';

type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type SelectChangeEvent = ChangeEvent<HTMLSelectElement>;
type TextChangeEvent = ChangeEvent<HTMLTextAreaElement>;

type InputChangeCallback = (e: InputChangeEvent) => void;
type SelectChangeCallback = (e: SelectChangeEvent) => void;
type TextChangeCallback = (e: TextChangeEvent) => void;

function useInputCallback(fn: InputChangeCallback, deps: any[]): InputChangeCallback
{
	return useCallback(fn, deps);
}

function useSelectCallback(fn: SelectChangeCallback, deps: any[]): SelectChangeCallback
{
	return useCallback(fn, deps);
}

function useTextCallback(fn: TextChangeCallback, deps: any[]): TextChangeCallback
{
	return useCallback(fn, deps);
}

const RecipeDispatchContext = createContext(null);

function useDispatch()
{
	return useContext(RecipeDispatchContext);
}

interface IElem
{
	id: number;
	value: string | null;
}

interface IEditableElem
{
	id: number;
	value: string;
	isTemp: boolean;
}

function makeEditable(elem: IElem, isTemp: boolean)
{
	return { isTemp, id: elem.id, value: elem.value || '' };
}

interface IRecipe
{
	id: number;
	title: string;
	owner_uid: number;
	is_published: number;
	is_vegan: number;
	course: number;
	notes: string|null;
	courtesy_of: string|null;
	ingredients: IElem[];
	directions: IElem[];
}

interface IEditableArray
{
	elems: IEditableElem[];
	deletedIds: number[];
	selectedIndex: number;
}

interface IEditableRecipe
{
	id: number;
	title: string;
	isVegan: boolean;
	isPublished: boolean;
	course: number;
	notes: string;
	courtesyOf: string;
	ingredients: IEditableArray;
	directions: IEditableArray;
}

type IsEditableArray<T, P extends keyof T> = T[P] extends IEditableArray ? P : never;

type EditableArrayPropsGen<T> = {
	[P in keyof T as IsEditableArray<T, P>]: T[P];
};

type EditableArrayProps = keyof EditableArrayPropsGen<IEditableRecipe>;

interface IEditState
{
	recipe: IEditableRecipe;
	savedRecipe: IEditableRecipe;
	isSaving: boolean;
	tempIdCounter: number;
}

interface ISetPropAction<PropKey extends keyof IEditableRecipe>
{
	type: 'setProp';
	propKey: PropKey;
	value: IEditableRecipe[PropKey];
}

function doSetProp<PropKey extends keyof IEditableRecipe>(recipe: IEditableRecipe, propKey: PropKey, value: IEditableRecipe[PropKey])
{
	recipe[propKey] = value;
}

function useSetProp<PropKey extends keyof IEditableRecipe>(propKey: PropKey)
{
	const dispatch = useDispatch();
	return (value: IEditableRecipe[PropKey]) => {
		dispatch({ type: 'setProp', propKey, value });
	};
}

type SetPropActions = {
	[P in keyof IEditableRecipe]: ISetPropAction<P>;
};

type ExtractEditableArray<T> = {
	[P in keyof T as T[P] extends IEditableArray ? P : never]: T[P];
};

interface ISetElemValueAction
{
	type: 'setElemValue';
	propKey: EditableArrayProps;
	value: string;
}

function useSetElemValue()
{
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, value: string) => {
		dispatch({ type: 'setElemValue', propKey, value });
	};
}

interface IAddElemAction
{
	type: 'addElem';
	propKey: EditableArrayProps;
}

function useAddElem()
{
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps) => {
		dispatch({ type: 'addElem', propKey });
	};
}

interface IRemoveElemAction
{
	type: 'removeElem';
	propKey: EditableArrayProps;
}

function useRemoveElem()
{
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps) => {
		dispatch({ type: 'removeElem', propKey });
	};
}

interface ISelectElemAction
{
	type: 'selectElem';
	propKey: EditableArrayProps;
	index: number;
}

function useSelectElem()
{
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, index: number) => {
		dispatch({ type: 'selectElem', propKey, index });
	};
}

interface IMoveElemAction
{
	type: 'moveElem';
	propKey: EditableArrayProps;
	fromIndex: number;
	toIndex: number;
}

function useMoveElem()
{
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, fromIndex: number, toIndex: number) => {
		dispatch({ type: 'moveElem', propKey, fromIndex, toIndex });
	};
}

interface IBeginSaveAction
{
	type: 'beginSave';
}

interface ISaveErrorResponse
{
	error: string;
}

interface ISaveSuccessResponse
{
	mappedIngredients: { [tempId: string]: number }; 
	mappedDirections: { [tempId: string]: number }; 
}

type SaveResponse = ISaveErrorResponse | ISaveSuccessResponse;

function isSaveErr(resp: any): resp is ISaveErrorResponse
{
	return !!resp.error;
}

interface ISaveRequest
{
	recipe: IEditableRecipe;
}

interface IEndSaveAction
{
	type: 'endSave';
	response: SaveResponse;
	request: ISaveRequest;
}

type EditAction =
	ISetElemValueAction
	| IAddElemAction
	| IRemoveElemAction
	| ISelectElemAction
	| IMoveElemAction
	| IBeginSaveAction
	| IEndSaveAction
	| SetPropActions[keyof IEditableRecipe]
;

function reducer(state: IEditState, action: EditAction): IEditState
{
	let { isSaving, savedRecipe, tempIdCounter } = state;

	const recipe = {...state.recipe};

	if (action.type === 'setProp')
	{
		doSetProp(recipe, action.propKey, action.value);
	}
	else if (action.type === 'setElemValue')
	{
		const { propKey, value } = action;
		const array = recipe[propKey];
		const {selectedIndex, deletedIds} = array;
		const elems = [...array.elems];
		const elem = {...elems[selectedIndex]};
		elem.value = value;
		elems[selectedIndex] = elem;
		recipe[propKey] = {selectedIndex, deletedIds, elems};
	}
	else if (action.type === 'addElem')
	{
		const { propKey } = action;
		const array = recipe[propKey];
		const {selectedIndex, deletedIds} = array;
		const elems = [];

		for (let i = 0; i < array.elems.length; ++i)
		{
			elems.push(array.elems[i]);
			if (i === selectedIndex)
				elems.push({ id: --tempIdCounter, value: '', isTemp: true });
		}

		recipe[propKey] = {
			selectedIndex: selectedIndex+1,
			deletedIds,
			elems
		};
	}
	else if (action.type === 'removeElem')
	{
		const { propKey } = action;
		const array = recipe[propKey];
		const {selectedIndex} = array;
		const elems = [...array.elems];
		const elem = elems[selectedIndex];

		if (elems.length > 1)
			elems.splice(selectedIndex, 1);
		else
			elems[0].value = '';

		const deletedIds = [...array.deletedIds];
		deletedIds.push(elem.id);

		recipe[propKey] = {
			selectedIndex: Math.max(0, selectedIndex-1),
			deletedIds,
			elems
		};
	}
	else if (action.type === 'selectElem')
	{
		const { propKey, index } = action;
		const array = {...recipe[propKey]};
		array.selectedIndex = index;
		recipe[propKey] = array;
	}
	else if (action.type === 'moveElem')
	{
		const { propKey, fromIndex, toIndex } = action;
		const array = recipe[propKey];
		const {selectedIndex,deletedIds} = array;
		const elems = [...array.elems];
		const elem = elems[fromIndex];
		elems.splice(fromIndex, 1);
		elems.splice(toIndex, 0, elem);
		recipe[propKey] = {
			selectedIndex: toIndex,
			deletedIds,
			elems
		};
	}
	else if (action.type === 'beginSave')
	{
		isSaving = true;
	}
	else if (action.type === 'endSave')
	{
		const { response, request } = action;

		isSaving = false;

		if (isSaveErr(response))
		{
			console.error(response.error);
		}
		else
		{
			const reqRec = request.recipe;
			const currentIngredients = structuredClone(recipe.ingredients);
			const currentDirections = structuredClone(recipe.directions);

			reconcileEditedArray(
				currentIngredients,
				reqRec.ingredients,
				response.mappedIngredients
			);

			reconcileEditedArray(
				currentDirections,
				reqRec.directions,
				response.mappedDirections
			);
			
			recipe.ingredients = currentIngredients;
			recipe.directions = currentDirections;
			savedRecipe = reqRec;
		}
	}

	return { 
		tempIdCounter,
		isSaving,
		savedRecipe,
		recipe
	};
}

function reconcileEditedArray(
	current: IEditableArray,
	requested: IEditableArray,
	mappedIds: { [key: string]: number }
): void
{
	for (const elem of requested.elems)
	{
		if (elem.isTemp)
		{
			const tempId = elem.id;
			elem.isTemp = false;
			elem.id = mappedIds[`${tempId}`];

			for (const curElem of current.elems)
			{
				if (curElem.isTemp && curElem.id === tempId)
				{
					curElem.isTemp = false;
					curElem.id = elem.id;
					break;
				}
			}
		}
	}

	const deletedSet = new Set(requested.deletedIds);
	requested.deletedIds = [];

	const curDeletedIds = [];
	for (const id of current.deletedIds)
	{
		if (!deletedSet.has(id))
			curDeletedIds.push(id);
	}

	current.deletedIds = curDeletedIds;
}

function sameEditableElem(a: IEditableElem, b: IEditableElem)
{
	return a.isTemp === b.isTemp && a.value === b.value && a.id === b.id;
}

function sameEditableArrayContent(a: IEditableArray, b: IEditableArray)
{
	if (a.elems.length !== b.elems.length)
		return false;

	if (a.deletedIds.length !== b.deletedIds.length)
		return false;

	for (let i = 0; i < a.elems.length; ++i)
	{
		if (!sameEditableElem(a.elems[i], b.elems[i]))
			return false;
	}

	for (let i = 0; i < a.deletedIds.length; ++i)
		if (a.deletedIds[i] !== b.deletedIds[i])
			return false;

	return true;
}

function pageHasChange(state: IEditState): boolean
{
	const { recipe, savedRecipe } = state;
	if (recipe.title !== savedRecipe.title)
		return true;

	if (recipe.isVegan !== savedRecipe.isVegan)
		return true;

	if (recipe.isPublished !== savedRecipe.isPublished)
		return true;

	if (recipe.course !== savedRecipe.course)
		return true;

	if (recipe.notes !== savedRecipe.notes)
		return true;

	if (recipe.courtesyOf !== savedRecipe.courtesyOf)
		return true;

	if (!sameEditableArrayContent(recipe.ingredients, savedRecipe.ingredients))
		return true;

	if (!sameEditableArrayContent(recipe.directions, savedRecipe.directions))
		return true;

	return false;
}

interface IPageModel
{
	recipe: IRecipe;
	courses: string[]; // array of titles
	saveUri: string;
	viewUri: string;
}

function Page(props: IPageModel)
{
	const initRecipe: IEditableRecipe = {
		id: props.recipe.id,
		title: props.recipe.title,
		isVegan: !!props.recipe.is_vegan,
		isPublished: !!props.recipe.is_published,
		course: props.recipe.course,
		notes: props.recipe.notes || '',
		courtesyOf: props.recipe.courtesy_of || '',
		ingredients: {
			elems: props.recipe.ingredients.map((e) => makeEditable(e, false)),
			deletedIds: [],
			selectedIndex: 0
		},
		directions: {
			elems: props.recipe.directions.map((e) => makeEditable(e, false)),
			deletedIds: [],
			selectedIndex: 0
		}
	};

	const initialState: IEditState = {
		recipe: initRecipe,
		savedRecipe: structuredClone(initRecipe),
		isSaving: false,
		tempIdCounter: -1
	};

	const [state, dispatch] = useReducer(reducer, initialState);
	const { isSaving } = state;

	const hasChange = pageHasChange(state);

	const { recipe } = state;

	const onSave = useCallback(async () => {
		dispatch({ type: 'beginSave' });

		const request = { recipe: structuredClone(recipe) };

		const response = await postJson<SaveResponse>(props.saveUri, { body: request });

		dispatch({ type: 'endSave', response, request });
	}, [recipe]);

	return <div>
			<RecipeDispatchContext.Provider value={dispatch}>
				<AutoSaveForm onSave={onSave} hasChange={hasChange}>
					<div className="header">
						<h1> Edit recipe </h1>
						<p className="save-indicator">
						<input type="checkbox" readOnly checked={!hasChange} /> 
						Saved
						</p>
					</div>

					<div className="section-container">
						<RecipeStatus recipe={recipe} viewUri={props.viewUri} />
						<RecipeProperties recipe={recipe} courses={props.courses} />
						<EditArraySection
							title="Ingredients"
							propKey="ingredients"
							array={recipe.ingredients} />

						<EditArraySection
							title="Directions"
							propKey="directions"
							array={recipe.directions} />

						<Notes notes={recipe.notes} />
					</div>
				</AutoSaveForm>
			</RecipeDispatchContext.Provider>
		</div>;
}

interface IRecipePropertiesProps
{
	recipe: IEditableRecipe;
	courses: string[]
}

function RecipeProperties(props: IRecipePropertiesProps)
{
	const { title, isVegan, course, courtesyOf } = props.recipe;
	const { courses } = props;

	const setTitle = useSetProp('title');
	const onChangeTitle = useInputCallback((e) => {
		setTitle(e.target.value);
	}, []);

	const setCourtesyOf = useSetProp('courtesyOf');
	const onChangeCourtesyOf = useInputCallback((e) => {
		setCourtesyOf(e.target.value);
	}, []);

	const setIsVegan = useSetProp('isVegan');
	const onChangeIsVegan = useInputCallback((e) => {
		setIsVegan(e.target.checked);
	}, []);

	const courseOptions = [];
	for (let i = 0; i < courses.length; ++i)
	{
		courseOptions.push(
			<option key={courses[i]} value={i+1}>
				{courses[i]}
			</option>
		);
	}
	const setCourse = useSetProp('course');
	const onChangeCourse = useSelectCallback((e) => {
		setCourse(parseInt(e.target.value));
	}, []);

	return <Section title="Recipe">
		<div>
			<label> Title: <input type="text"
				value={title}
				onChange={onChangeTitle}
				/>
			</label>
			<label> Course:
				<select onChange={onChangeCourse} value={course}>
					{courseOptions}
				</select>
			</label>
			<label> Courtesy of: <input type="text"
				value={courtesyOf}
				onChange={onChangeCourtesyOf}
				title="Who gave you this recipe?"
				/>
			</label>
		</div>
		<div>
			<label> <input type="checkbox"
				checked={isVegan}
				onChange={onChangeIsVegan}
				/> Is Vegan
			</label>
		</div>
	</Section>;
}

interface IRecipeStatusProps
{
	recipe: IEditableRecipe;
	viewUri: string;
}

function RecipeStatus(props: IRecipeStatusProps)
{
	const { recipe, viewUri } = props;
	const { isPublished } = recipe;

	const setIsPublished = useSetProp('isPublished');
	const onChangeIsPublished = useInputCallback((e) => {
		setIsPublished(!!parseInt(e.target.value));
	}, []);

	return <Section title="Status">
		<p><a href={viewUri}> View Recipe </a></p>

		<fieldset className="visibility">
			<legend> Visibility </legend>
			<label>
				<input type="radio"
					name="is_published"
					value="1"
					checked={isPublished}
					onChange={onChangeIsPublished}
					/> Published
			</label>
			<label>
				<input type="radio"
					name="is_published"
					value="0"
					checked={!isPublished}
					onChange={onChangeIsPublished}
					/> Private
			</label>
		</fieldset>
	</Section>;
}

interface INotesProps
{
	notes: string|null;
}

function Notes(props: INotesProps)
{
	const setNotes = useSetProp("notes");
	const onChangeNotes = useTextCallback((e) => {
		setNotes(e.target.value);
	}, []);

	return <Section title="Notes">
		<textarea
			value={props.notes} onChange={onChangeNotes}
		>
		</textarea>
	</Section>;
}

interface IEditArraySectionProps
{
	array: IEditableArray;
	title: string;
	propKey: EditableArrayProps;
}

function EditArraySection(props: IEditArraySectionProps)
{
	const { array, title, propKey } = props;

	const inputRef = useRef<HTMLInputElement>(null);

	const selected = array.elems[array.selectedIndex];
	const elemIsEmpty = selected.value === '';
	const { selectedIndex, elems } = array;

	const setElemValue = useSetElemValue();
	const onValueChange = useInputCallback((e) => {
		setElemValue(propKey, e.target.value);
	}, [propKey]);

	const addElem = useAddElem();
	const onClickAdd = useCallback(() =>  {
		addElem(propKey);
		inputRef.current.focus();
	}, [propKey]);

	const removeElem = useRemoveElem();
	const onClickRemove = useCallback(() =>  {
		removeElem(propKey);
		inputRef.current.focus();
	}, [propKey]);

	const selectElem = useSelectElem();
	const moveElem = useMoveElem();

	const onKeyDown = useCallback((e: KeyboardEvent) => {
		const inInput = e.target === inputRef.current;
		const count = elems.length;

		if (e.key === 'Enter' && inInput)
		{
			addElem(propKey);
		}
		else if (e.key === 'Backspace')
		{
			if (!inInput)
			{
				removeElem(propKey);
			}
			else if ((elemIsEmpty && !e.repeat) || e.shiftKey)
			{
				removeElem(propKey);
				e.preventDefault();
			}
		}
		else if (e.key === 'ArrowDown')
		{
			if (e.shiftKey)
			{
				if (selectedIndex < count-1)
					moveElem(propKey, selectedIndex, selectedIndex+1);
			}
			else
			{
				selectElem(propKey, (selectedIndex + 1) % count);
			}
			e.preventDefault();
		}
		else if (e.key === 'ArrowUp')
		{
			if (e.shiftKey)
			{
				if (selectedIndex > 0)
					moveElem(propKey, selectedIndex, selectedIndex-1);
			}
			else
			{
				selectElem(propKey, (count + selectedIndex - 1) % count);
			}
			e.preventDefault();
		}
	}, [propKey, elemIsEmpty, elems.length, selectedIndex]);

	const items = elems.map((e, i) => {
		
		const text = i === selectedIndex ? <u> {e.value} </u> : e.value;
		const onClick = (e: MouseEvent<HTMLLIElement>) => {
			selectElem(propKey, i);
			inputRef.current.focus();
		};

		const onDragStart = (e: DragEvent<HTMLLIElement>) => {
			e.dataTransfer.dropEffect = 'move';
			e.dataTransfer.setData('x-application/recipe', i.toString());
		};

		const onDrop = (e: DragEvent<HTMLLIElement>) => {
			const index = parseInt(e.dataTransfer.getData('x-application/recipe'));
			moveElem(propKey, index, i);
			inputRef.current.focus();
		};

		const onDragOver = (e: DragEvent<HTMLLIElement>) => {
			e.dataTransfer.dropEffect = 'move';
			e.preventDefault();
		};

		return <li
			key={e.id}
			onClick={onClick}
			draggable onDragStart={onDragStart}
			onDrop={onDrop}
			onDragOver={onDragOver}
		> {text} </li>;
	});

	return <Section title={title}>
		<div onKeyDown={onKeyDown}>
			<input
				ref={inputRef}
				type="text"
				value={selected.value}
				onChange={onValueChange}
				size={72}
			/>
			<button onClick={onClickAdd}> + </button>
			<button onClick={onClickRemove}> - </button>
		</div>
		<ol> {items} </ol>
	</Section>;
}

interface ISectionProps
{
	title: string;
}

function Section(props: React.PropsWithChildren<ISectionProps>)
{
	return <section className="section">
		<h3> {props.title} </h3>
		{props.children}
	</section>;
}

renderReactPage<IPageModel>(model => <Page {...model} />);

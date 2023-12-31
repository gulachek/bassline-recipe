import * as React from 'react';
import {
	useReducer,
	createContext,
	useContext,
	useCallback,
	useRef,
	useId,
	useEffect,
	ChangeEvent,
	MouseEvent,
	KeyboardEvent,
	DragEvent,
	FocusEvent,
	DependencyList,
} from 'react';

import { renderReactPage } from './renderReactPage';
import { postJson } from './postJson';
import { AutoSaveForm } from './autosave/AutoSaveForm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faPlus,
	faMinus,
	faTriangleExclamation,
	faGripVertical,
	faSpinner,
	faCircleCheck,
	faCircleXmark,
} from '@fortawesome/free-solid-svg-icons';

import './recipeEdit.scss';

type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type SelectChangeEvent = ChangeEvent<HTMLSelectElement>;
type TextChangeEvent = ChangeEvent<HTMLTextAreaElement>;

type InputChangeCallback = (e: InputChangeEvent) => void;
type SelectChangeCallback = (e: SelectChangeEvent) => void;
type TextChangeCallback = (e: TextChangeEvent) => void;

function useInputCallback(
	fn: InputChangeCallback,
	deps: DependencyList
): InputChangeCallback {
	return useCallback(fn, deps);
}

function useSelectCallback(
	fn: SelectChangeCallback,
	deps: DependencyList
): SelectChangeCallback {
	return useCallback(fn, deps);
}

function useTextCallback(
	fn: TextChangeCallback,
	deps: DependencyList
): TextChangeCallback {
	return useCallback(fn, deps);
}

const RecipeDispatchContext = createContext(null);

function useDispatch() {
	return useContext(RecipeDispatchContext);
}

interface IInputProps {
	required: boolean;
	maxLength: number;
	pattern?: string;
	title?: string;
}

interface IElem {
	id: number;
	value: string | null;
}

interface IEditableElem {
	id: number;
	value: string;
	isTemp: boolean;
}

function makeEditable(elem: IElem, isTemp: boolean) {
	return { isTemp, id: elem.id, value: elem.value || '' };
}

interface IRecipe {
	id: number;
	title: string;
	owner_uid: number;
	is_published: number;
	is_vegan: number;
	course: number;
	notes: string | null;
	courtesy_of: string | null;
	ingredients: IElem[];
	directions: IElem[];
}

interface IEditableArray {
	elems: IEditableElem[];
	deletedIds: number[];
	selectedIndex: number;
}

interface IEditableRecipe {
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

type IsEditableArray<T, P extends keyof T> = T[P] extends IEditableArray
	? P
	: never;

type EditableArrayPropsGen<T> = {
	[P in keyof T as IsEditableArray<T, P>]: T[P];
};

type EditableArrayProps = keyof EditableArrayPropsGen<IEditableRecipe>;

type IsScalar<T, P extends keyof T> = T[P] extends string | number | boolean
	? P
	: never;

type EditableScalarPropsGen<T> = {
	[P in keyof T as IsScalar<T, Exclude<P, 'id' | 'isPublished'>>]: T[P];
};

type EditableScalarProps = keyof EditableScalarPropsGen<IEditableRecipe>;

type IValidity = {
	[P in EditableScalarProps | EditableArrayProps]: P extends EditableScalarProps
		? boolean
		: boolean[];
};

type ValidityPropMap = { [key: string]: boolean | boolean[] };

function isScalarProp(
	key: string,
	validity: IValidity
): key is EditableScalarProps {
	return typeof (validity as ValidityPropMap)[key] === 'boolean';
}

function isArrayProp(
	key: string,
	validity: IValidity
): key is EditableArrayProps {
	return Array.isArray((validity as ValidityPropMap)[key]);
}

function isValid(validity: IValidity): boolean {
	for (const key in validity) {
		if (isScalarProp(key, validity) && !validity[key]) {
			return false;
		} else if (isArrayProp(key, validity)) {
			for (const elem of validity[key]) {
				if (!elem) return false;
			}
		}
	}

	return true;
}

interface IEditState {
	recipe: IEditableRecipe;
	savedRecipe: IEditableRecipe;
	validity: IValidity;
	isSaving: boolean;
	tempIdCounter: number;
	showDeleteDialog: boolean;
	saveKey: string;
	fatalError: string | null;
}

interface ISetPropAction<PropKey extends EditableScalarProps> {
	type: 'setProp';
	propKey: PropKey;
	value: IEditableRecipe[PropKey];
	isValid: boolean;
}

function doSetProp<PropKey extends keyof IEditableRecipe>(
	recipe: IEditableRecipe,
	propKey: PropKey,
	value: IEditableRecipe[PropKey]
) {
	recipe[propKey] = value;
}

function useSetProp<PropKey extends EditableScalarProps>(propKey: PropKey) {
	const dispatch = useDispatch();
	return (value: IEditableRecipe[PropKey], isValid?: boolean) => {
		if (typeof isValid === 'undefined') isValid = true;

		dispatch({ type: 'setProp', propKey, value, isValid });
	};
}

type SetPropActions = {
	[P in EditableScalarProps]: ISetPropAction<P>;
};

interface ISetElemValueAction {
	type: 'setElemValue';
	propKey: EditableArrayProps;
	value: string;
	isValid: boolean;
}

function useSetElemValue() {
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, value: string, isValid: boolean) => {
		dispatch({ type: 'setElemValue', propKey, value, isValid });
	};
}

interface IAddElemAction {
	type: 'addElem';
	propKey: EditableArrayProps;
}

function useAddElem() {
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps) => {
		dispatch({ type: 'addElem', propKey });
	};
}

interface IRemoveElemAction {
	type: 'removeElem';
	propKey: EditableArrayProps;
}

function useRemoveElem() {
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps) => {
		dispatch({ type: 'removeElem', propKey });
	};
}

interface ISelectElemAction {
	type: 'selectElem';
	propKey: EditableArrayProps;
	index: number;
}

function useSelectElem() {
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, index: number) => {
		dispatch({ type: 'selectElem', propKey, index });
	};
}

interface IMoveElemAction {
	type: 'moveElem';
	propKey: EditableArrayProps;
	fromIndex: number;
	toIndex: number;
}

function useMoveElem() {
	const dispatch = useDispatch();
	return (propKey: EditableArrayProps, fromIndex: number, toIndex: number) => {
		dispatch({ type: 'moveElem', propKey, fromIndex, toIndex });
	};
}

interface IBeginSaveAction {
	type: 'beginSave';
}

interface ISaveErrorResponse {
	error: string;
}

interface ISaveSuccessResponse {
	mappedIngredients: { [tempId: string]: number };
	mappedDirections: { [tempId: string]: number };
	newSaveKey: string;
	error?: never;
}

type SaveResponse = ISaveErrorResponse | ISaveSuccessResponse;

function isSaveErr(resp: SaveResponse): resp is ISaveErrorResponse {
	return !!resp.error;
}

interface ISaveRequest {
	recipe: IEditableRecipe;
	saveKey: string;
}

interface IEndSaveAction {
	type: 'endSave';
	response: SaveResponse;
	request: ISaveRequest;
}

interface IShowDialogAction {
	type: 'showDialog';
	show: boolean;
}

function useShowDialog() {
	const dispatch = useDispatch();
	return (show: boolean) => {
		dispatch({ type: 'showDialog', show });
	};
}

type EditAction =
	| ISetElemValueAction
	| IAddElemAction
	| IRemoveElemAction
	| ISelectElemAction
	| IMoveElemAction
	| IBeginSaveAction
	| IEndSaveAction
	| IShowDialogAction
	| SetPropActions[EditableScalarProps];

function normalizeLine(line: string): string {
	return line.replace(/\s+/g, ' ').trim();
}

function reducer(state: IEditState, action: EditAction): IEditState {
	let {
		isSaving,
		savedRecipe,
		tempIdCounter,
		showDeleteDialog,
		saveKey,
		fatalError,
	} = state;

	const validity = structuredClone(state.validity);
	const recipe = { ...state.recipe };

	if (action.type === 'setProp') {
		validity[action.propKey] = action.isValid;
		doSetProp(recipe, action.propKey, action.value);
	} else if (action.type === 'setElemValue') {
		const { propKey, value, isValid } = action;
		const array = recipe[propKey];
		const { selectedIndex, deletedIds } = array;
		const elems = [];

		for (let i = 0; i < array.elems.length; ++i) {
			if (i === selectedIndex) {
				const lines = (value || '').split(/[\r\n]/);
				const elem = { ...array.elems[selectedIndex] };
				elem.value = lines[0]; // normalizing selected line causes weird cursor jumpiness
				elems.push(elem);

				// subsequent lines are filtered out if whitespace
				for (let j = 1; j < lines.length; ++j) {
					const line = normalizeLine(lines[j]);
					if (line)
						elems.push({ id: --tempIdCounter, value: line, isTemp: true });
				}
			} else {
				elems.push(array.elems[i]);
			}
		}

		validity[propKey][selectedIndex] = isValid;
		recipe[propKey] = { selectedIndex, deletedIds, elems };
	} else if (action.type === 'addElem') {
		const { propKey } = action;
		const array = recipe[propKey];
		const { selectedIndex, deletedIds } = array;
		const elems = [];

		for (let i = 0; i < array.elems.length; ++i) {
			elems.push(array.elems[i]);
			if (i === selectedIndex) {
				elems.push({ id: --tempIdCounter, value: '', isTemp: true });
				validity[propKey].splice(selectedIndex + 1, 0, true); // starts out empty/valid
			}
		}

		recipe[propKey] = {
			selectedIndex: selectedIndex + 1,
			deletedIds,
			elems,
		};
	} else if (action.type === 'removeElem') {
		const { propKey } = action;
		const array = recipe[propKey];
		const { selectedIndex } = array;
		const elems = [...array.elems];
		const elem = elems[selectedIndex];

		const deletedIds = [...array.deletedIds];

		if (elems.length > 1) {
			elems.splice(selectedIndex, 1);
			validity[propKey].splice(selectedIndex, 1);
			if (!elem.isTemp) deletedIds.push(elem.id);
		} else {
			elems[0].value = '';
		}

		recipe[propKey] = {
			selectedIndex: Math.max(0, selectedIndex - 1),
			deletedIds,
			elems,
		};
	} else if (action.type === 'selectElem') {
		const { propKey, index } = action;
		const array = { ...recipe[propKey] };
		array.selectedIndex = index;
		recipe[propKey] = array;
	} else if (action.type === 'moveElem') {
		const { propKey, fromIndex, toIndex } = action;
		const array = recipe[propKey];
		const { deletedIds } = array;
		const elems = [...array.elems];
		const elem = elems[fromIndex];
		elems.splice(fromIndex, 1);
		elems.splice(toIndex, 0, elem);
		recipe[propKey] = {
			selectedIndex: toIndex,
			deletedIds,
			elems,
		};
	} else if (action.type === 'beginSave') {
		isSaving = true;
	} else if (action.type === 'endSave') {
		const { response, request } = action;

		isSaving = false;

		if (isSaveErr(response)) {
			fatalError = response.error;
			console.error(response.error);
		} else {
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
			saveKey = response.newSaveKey;
		}
	} else if (action.type === 'showDialog') {
		showDeleteDialog = action.show;
	}

	return {
		tempIdCounter,
		isSaving,
		savedRecipe,
		showDeleteDialog,
		recipe,
		saveKey,
		fatalError,
		validity,
	};
}

function reconcileEditedArray(
	current: IEditableArray,
	requested: IEditableArray,
	mappedIds: { [key: string]: number }
): void {
	for (const elem of requested.elems) {
		if (elem.isTemp) {
			const tempId = elem.id;
			elem.isTemp = false;
			elem.id = mappedIds[`${tempId}`];

			for (const curElem of current.elems) {
				if (curElem.isTemp && curElem.id === tempId) {
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
	for (const id of current.deletedIds) {
		if (!deletedSet.has(id)) curDeletedIds.push(id);
	}

	current.deletedIds = curDeletedIds;
}

function sameEditableElem(a: IEditableElem, b: IEditableElem) {
	return a.isTemp === b.isTemp && a.value === b.value && a.id === b.id;
}

function sameEditableArrayContent(a: IEditableArray, b: IEditableArray) {
	if (a.elems.length !== b.elems.length) return false;

	if (a.deletedIds.length !== b.deletedIds.length) return false;

	for (let i = 0; i < a.elems.length; ++i) {
		if (!sameEditableElem(a.elems[i], b.elems[i])) return false;
	}

	for (let i = 0; i < a.deletedIds.length; ++i)
		if (a.deletedIds[i] !== b.deletedIds[i]) return false;

	return true;
}

function pageHasChange(state: IEditState): boolean {
	const { recipe, savedRecipe } = state;
	if (recipe.title !== savedRecipe.title) return true;

	if (recipe.isVegan !== savedRecipe.isVegan) return true;

	if (recipe.isPublished !== savedRecipe.isPublished) return true;

	if (recipe.course !== savedRecipe.course) return true;

	if (recipe.notes !== savedRecipe.notes) return true;

	if (recipe.courtesyOf !== savedRecipe.courtesyOf) return true;

	if (!sameEditableArrayContent(recipe.ingredients, savedRecipe.ingredients))
		return true;

	if (!sameEditableArrayContent(recipe.directions, savedRecipe.directions))
		return true;

	return false;
}

interface IPageModel {
	recipe: IRecipe;
	courses: string[]; // array of titles
	saveUri: string;
	viewUri: string;
	deleteUri: string;
	publishUri: string;
	initialSaveKey: string;
	titleField: IInputProps;
	courtesyOfField: IInputProps;
	notesField: IInputProps;
	ingredientField: IInputProps;
	directionField: IInputProps;
	maxListEntries: number;
}

function Page(props: IPageModel) {
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
			selectedIndex: 0,
		},
		directions: {
			elems: props.recipe.directions.map((e) => makeEditable(e, false)),
			deletedIds: [],
			selectedIndex: 0,
		},
	};

	const initialState: IEditState = {
		recipe: initRecipe,
		savedRecipe: structuredClone(initRecipe),
		isSaving: false,
		tempIdCounter: -1,
		showDeleteDialog: false,
		saveKey: props.initialSaveKey,
		fatalError: null,
		validity: {
			title: true,
			course: true,
			notes: true,
			isVegan: true,
			courtesyOf: true,
			ingredients: props.recipe.ingredients.map(() => true),
			directions: props.recipe.directions.map(() => true),
		},
	};

	const [state, dispatch] = useReducer(reducer, initialState);

	const hasChange = pageHasChange(state);

	const { recipe, saveKey, fatalError, validity, isSaving } = state;

	const onSave = useCallback(async () => {
		dispatch({ type: 'beginSave' });

		const request = { recipe: structuredClone(recipe), saveKey };

		const response = await postJson<SaveResponse>(props.saveUri, {
			body: request,
		});

		dispatch({ type: 'endSave', response, request });
	}, [recipe, saveKey]);

	const hasError = !!fatalError || !isValid(validity);
	const shouldSave = hasChange && !(isSaving || hasError);

	return (
		<React.Fragment>
			<RecipeDispatchContext.Provider value={dispatch}>
				<AutoSaveForm onSave={onSave} shouldSave={shouldSave} />
				<DeleteDialog
					open={state.showDeleteDialog}
					deleteUri={props.deleteUri}
					recipeId={recipe.id}
				/>
				{fatalError && <ErrorBanner msg={fatalError} />}
				<div className="header">
					<h1> Edit recipe </h1>
				</div>

				<div className="section-container">
					<RecipeActions
						isPublished={!!props.recipe.is_published}
						publishUri={props.publishUri}
						recipeId={props.recipe.id}
					/>
					<hr />
					<RecipeProperties
						recipe={recipe}
						courses={props.courses}
						titleField={props.titleField}
						courtesyOfField={props.courtesyOfField}
					/>
					<hr />
					<EditArraySection
						title="Ingredients"
						propKey="ingredients"
						array={recipe.ingredients}
						maxLength={props.maxListEntries}
						field={props.ingredientField}
						validity={validity.ingredients}
					/>

					<hr />

					<EditArraySection
						title="Directions"
						propKey="directions"
						array={recipe.directions}
						maxLength={props.maxListEntries}
						field={props.directionField}
						validity={validity.directions}
					/>

					<hr />

					<Notes notes={recipe.notes} notesField={props.notesField} />
				</div>
				<div className="footer">
					<RecipeStatus
						recipe={recipe}
						viewUri={props.viewUri}
						isSaving={isSaving || shouldSave}
						hasError={hasError}
					/>
				</div>
			</RecipeDispatchContext.Provider>
		</React.Fragment>
	);
}

interface IRecipePropertiesProps {
	recipe: IEditableRecipe;
	courses: string[];
	titleField: IInputProps;
	courtesyOfField: IInputProps;
}

function RecipeProperties(props: IRecipePropertiesProps) {
	const { title, isVegan, course, courtesyOf } = props.recipe;
	const { courses, titleField, courtesyOfField } = props;

	const setTitle = useSetProp('title');
	const onChangeTitle = useInputCallback((e) => {
		setTitle(e.target.value, e.target.reportValidity());
	}, []);

	const onTitleLoseFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
		e.target.value = normalizeLine(e.target.value);
		setTitle(e.target.value, e.target.reportValidity());
	}, []);

	const setCourtesyOf = useSetProp('courtesyOf');
	const onChangeCourtesyOf = useInputCallback((e) => {
		setCourtesyOf(e.target.value, e.target.reportValidity());
	}, []);

	const onCourtesyOfLoseFocus = useCallback(
		(e: FocusEvent<HTMLInputElement>) => {
			e.target.value = normalizeLine(e.target.value);
			setCourtesyOf(e.target.value, e.target.reportValidity());
		},
		[]
	);

	const setIsVegan = useSetProp('isVegan');
	const onChangeIsVegan = useInputCallback((e) => {
		setIsVegan(e.target.checked);
	}, []);

	const courseOptions = [];
	for (let i = 0; i < courses.length; ++i) {
		courseOptions.push(
			<option key={courses[i]} value={i + 1}>
				{courses[i]}
			</option>
		);
	}
	const setCourse = useSetProp('course');
	const onChangeCourse = useSelectCallback((e) => {
		setCourse(parseInt(e.target.value));
	}, []);

	const titleId = useId();
	const courseId = useId();
	const courtesyOfId = useId();
	const isVeganId = useId();

	return (
		<Section>
			<div className="recipe-props">
				<label htmlFor={titleId}> Title: </label>
				<input
					id={titleId}
					type="text"
					value={title}
					onChange={onChangeTitle}
					onBlur={onTitleLoseFocus}
					{...titleField}
				/>
				<label htmlFor={courseId}> Course: </label>
				<select id={courseId} onChange={onChangeCourse} value={course}>
					{courseOptions}
				</select>
				<label htmlFor={courtesyOfId}> Courtesy of: </label>
				<input
					type="text"
					id={courtesyOfId}
					value={courtesyOf}
					onChange={onChangeCourtesyOf}
					onBlur={onCourtesyOfLoseFocus}
					{...courtesyOfField}
				/>
				<label htmlFor={isVeganId}> Is Vegan: </label>
				<input
					type="checkbox"
					id={isVeganId}
					checked={isVegan}
					onChange={onChangeIsVegan}
				/>
			</div>
		</Section>
	);
}

interface IRecipeActionsProps {
	recipeId: number;
	isPublished: boolean;
	publishUri: string;
}

function RecipeActions(props: IRecipeActionsProps) {
	const { recipeId, publishUri, isPublished } = props;

	const showDialog = useShowDialog();
	const clickDelete = useCallback(() => {
		showDialog(true);
	}, []);

	return (
		<div className="recipe-actions">
			<button onClick={clickDelete}> Delete Recipe </button>

			<form method="POST" action={publishUri}>
				<input type="hidden" name="id" value={recipeId} />
				<input type="hidden" name="publish" value={isPublished ? 0 : 1} />
				<button> {isPublished ? 'Unpublish' : 'Publish'} Recipe </button>
			</form>
		</div>
	);
}

interface IRecipeStatusProps {
	recipe: IEditableRecipe;
	viewUri: string;
	isSaving: boolean;
	hasError: boolean;
}

function RecipeStatus(props: IRecipeStatusProps) {
	const { viewUri, isSaving, hasError } = props;

	return (
		<React.Fragment>
			<SaveIndicator isSaving={isSaving} showError={hasError} />
			<a href={viewUri}> View Recipe </a>
		</React.Fragment>
	);
}

interface INotesProps {
	notes: string | null;
	notesField: IInputProps;
}

function Notes(props: INotesProps) {
	const { notes, notesField } = props;

	const setNotes = useSetProp('notes');
	const onChangeNotes = useTextCallback((e) => {
		setNotes(e.target.value, e.target.reportValidity());
	}, []);

	const onNotesLoseFocus = useCallback((e: FocusEvent<HTMLTextAreaElement>) => {
		e.target.value = normalizeLine(e.target.value);
		setNotes(e.target.value, e.target.reportValidity());
	}, []);

	const onKeydown = useCallback((e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
		}
	}, []);

	return (
		<Section title="Notes">
			<textarea
				value={notes}
				onChange={onChangeNotes}
				onBlur={onNotesLoseFocus}
				onKeyDown={onKeydown}
				{...notesField}
			></textarea>
		</Section>
	);
}

interface IEditArraySectionProps {
	array: IEditableArray;
	title: string;
	propKey: EditableArrayProps;
	maxLength: number; // max number of entries
	field: IInputProps;
	validity: boolean[];
}

function EditArraySection(props: IEditArraySectionProps) {
	const { array, title, propKey, maxLength, field, validity } = props;

	const inputRef = useRef<HTMLTextAreaElement>();

	const { selectedIndex, elems } = array;
	const selected = elems[selectedIndex];
	const elemIsEmpty = selected.value === '';

	useEffect(() => {
		inputRef.current.reportValidity();
	}, [selectedIndex]);

	const setElemValue = useSetElemValue();
	const onValueChange = useTextCallback(
		(e) => {
			setElemValue(propKey, e.target.value, e.target.reportValidity());
		},
		[propKey]
	);

	const onLoseFocus = useCallback(
		(e: FocusEvent<HTMLTextAreaElement>) => {
			e.target.value = normalizeLine(e.target.value);
			setElemValue(propKey, e.target.value, e.target.reportValidity());
		},
		[propKey]
	);

	const addElem = useAddElem();
	const onClickAdd = useCallback(() => {
		addElem(propKey);
		inputRef.current.focus();
	}, [propKey]);

	const removeElem = useRemoveElem();
	const onClickRemove = useCallback(() => {
		removeElem(propKey);
		inputRef.current.focus();
	}, [propKey]);

	const selectElem = useSelectElem();
	const moveElem = useMoveElem();

	const onKeyDown = useCallback(
		(e: KeyboardEvent) => {
			const inInput = e.target === inputRef.current;
			const count = elems.length;

			if (e.key === 'Enter' && inInput) {
				e.preventDefault();
				if (count < maxLength) addElem(propKey);
			} else if (e.key === 'Delete' && !e.shiftKey) {
				removeElem(propKey);
				e.preventDefault();
			} else if (e.key === 'ArrowDown') {
				if (e.shiftKey) {
					if (selectedIndex < count - 1)
						moveElem(propKey, selectedIndex, selectedIndex + 1);
				} else {
					selectElem(propKey, (selectedIndex + 1) % count);
				}
				e.preventDefault();
			} else if (e.key === 'ArrowUp') {
				if (e.shiftKey) {
					if (selectedIndex > 0)
						moveElem(propKey, selectedIndex, selectedIndex - 1);
				} else {
					selectElem(propKey, (count + selectedIndex - 1) % count);
				}
				e.preventDefault();
			}
		},
		[propKey, elemIsEmpty, elems.length, selectedIndex, maxLength]
	);

	const items = elems.map((e, i) => {
		const onClick = () => {
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

		let className = 'array-item';
		if (i === selectedIndex) className += ' selected';
		if (!validity[i]) className += ' invalid';

		return (
			<li
				className={className}
				key={e.id}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onClick={onClick}
				draggable
				onDragStart={onDragStart}
			>
				<FontAwesomeIcon icon={faGripVertical} />
				{e.value}
			</li>
		);
	});

	return (
		<Section title={title}>
			<div className="array-control-panel" onKeyDown={onKeyDown}>
				<textarea
					className="array-text-input"
					ref={inputRef}
					value={selected.value}
					onChange={onValueChange}
					onBlur={onLoseFocus}
					{...field}
				/>
				<br />
				<button onClick={onClickAdd} disabled={elems.length >= maxLength}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				<button onClick={onClickRemove}>
					<FontAwesomeIcon icon={faMinus} />
				</button>
			</div>
			<ol className="array-edit-list"> {items} </ol>
		</Section>
	);
}

interface IDeleteDialogProps {
	open: boolean;
	recipeId: number;
	deleteUri: string;
}

function DeleteDialog(props: IDeleteDialogProps) {
	const { open, deleteUri, recipeId } = props;
	const showDialog = useShowDialog();

	const clickCancel = useCallback((e: MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		showDialog(false);
	}, []);

	return (
		<ModalDialog open={open} className="warning">
			<form method="POST" action={deleteUri}>
				<input type="hidden" name="id" value={recipeId} />
				<h2>
					<FontAwesomeIcon icon={faTriangleExclamation} />
					Delete Recipe
				</h2>
				<p>
					Are you sure you want to delete this recipe? This is a{' '}
					<strong> permanent </strong> action that cannot be undone.
				</p>
				<p>
					<button> Delete </button>
					<button onClick={clickCancel}> Cancel </button>
				</p>
			</form>
		</ModalDialog>
	);
}

interface ISectionProps {
	title?: string;
}

function Section(props: React.PropsWithChildren<ISectionProps>) {
	return (
		<section className="section">
			{props.title && <h3> {props.title} </h3>}
			{props.children}
		</section>
	);
}

interface IModalDialogProps {
	open: boolean;
	className?: string;
}

function ModalDialog(props: React.PropsWithChildren<IModalDialogProps>) {
	const { open, children, className } = props;

	const ref = useRef<HTMLDialogElement>(null);

	type CloseListener = (this: HTMLDialogElement, ev: Event) => void;
	const listener = useRef<CloseListener>(null);

	const showDialog = useShowDialog();

	useEffect(() => {
		if (listener.current)
			ref.current.removeEventListener('close', listener.current);

		listener.current = () => {
			showDialog(false);
		};
		ref.current.addEventListener('close', listener.current);

		if (open) ref.current.showModal();
		else ref.current.close();
	}, [open]);

	return (
		<dialog ref={ref} className={className}>
			{children}
		</dialog>
	);
}

interface ISaveIndicatorProps {
	isSaving: boolean;
	showError: boolean;
}

function SaveIndicator(props: ISaveIndicatorProps) {
	const { showError, isSaving } = props;
	let icon, className, text;

	if (isSaving) {
		icon = <FontAwesomeIcon className="icon saving" icon={faSpinner} spin />;
		text = 'Saving';
		className = 'saving';
	} else if (showError) {
		icon = <FontAwesomeIcon className="icon error" icon={faCircleXmark} />;
		text = 'Error';
		className = 'error';
	} else {
		icon = <FontAwesomeIcon className="icon success" icon={faCircleCheck} />;
		text = 'Saved';
		className = 'success';
	}

	return (
		<p className="save-indicator">
			{icon}
			<span className={className + ' text'}> {text} </span>
		</p>
	);
}

interface IErrorBannerProps {
	msg: string;
}

function ErrorBanner(props: IErrorBannerProps) {
	const divRef = useRef<HTMLDivElement>();
	useEffect(() => {
		if (divRef.current) divRef.current.scrollIntoView();
	});

	const { msg } = props;
	return (
		<div ref={divRef} className="error-banner">
			{msg}
		</div>
	);
}

renderReactPage<IPageModel>((model) => <Page {...model} />);

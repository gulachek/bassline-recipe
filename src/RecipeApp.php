<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\App;
use Gulachek\Bassline\Semver;
use Gulachek\Bassline\RespondArg;
use Gulachek\Bassline\Redirect;
use Gulachek\Bassline\Responder;
use Gulachek\Bassline\ArrayProperty;
use Gulachek\Bassline\SaveToken;

function normalizeLine(string $str): string
{
	return \preg_replace('/\s+/', ' ', \trim($str));
}

class RecipeApp extends App
{
	private RecipeDatabase $db;

	private const COURSES = [
		'Entree',
		'Appetizer',
		'Side',
		'Soup',
		'Salad',
		'Dessert'
	];

	private const MAX_RECIPES = 32;
	private const MAX_LIST_ENTRIES = 64; // ingredients, directions

	public function __construct(
		string $dbPath,
		private string $baseUri
	) {
		parent::__construct(__DIR__ . '/..');
		$this->db = RecipeDatabase::fromPath($dbPath);
	}

	public function title(): string
	{
		return 'Recipe';
	}

	public function iconPath(): string
	{
		return __DIR__ . '/utensils.svg';
	}

	public function version(): Semver
	{
		return new Semver(0, 1, 0);
	}

	public function install(): ?string
	{
		$this->db->install();
		return null;
	}

	public function upgradeFromVersion(Semver $version): ?string
	{
		return null;
	}

	public function colors(): array
	{
		return [
			/*
			'greeting' => [
				'description' => 'Color for a greeting, duh?',
				'example-uri' => '/',
				'default-system-bg' => SystemColor::CANVAS,
				'default-system-fg' => SystemColor::CANVAS_TEXT
			],
			 */];
	}

	public function capabilities(): array
	{
		return [
			'edit_recipe' => [
				'description' => 'User can create and edit recipes created by himself.'
			],
			'edit_any_recipe' => [
				'description' => 'User can create and edit any recipe, including those created by others. Overrides edit_recipe.'
			],
			'create_unlimited_recipes' => [
				'description' => 'User can create as many recipes as he\'d like.'
			]
		];
	}

	private function canCreateRecipe(RespondArg $arg)
	{
		return $arg->userCan('edit_recipe') || $arg->userCan('edit_any_recipe');
	}

	private function canEditRecipe(
		RespondArg $arg,
		array $recipe
	): bool {
		if ($arg->userCan('edit_any_recipe'))
			return true;

		if (!$arg->userCan('edit_recipe'))
			return false;

		return $arg->uid() === $recipe['owner_uid'];
	}

	private function canViewRecipe(
		RespondArg $arg,
		array $recipe
	): bool {
		if ($this->canEditRecipe($arg, $recipe))
			return true;

		return !!$recipe['is_published'];
	}

	public function respond(RespondArg $arg): mixed
	{
		return $arg->route([
			'.' => $this->handler('selectPublished'),
			'my_recipes' => $this->handler('myRecipes'),
			'create' => $this->handler('create'),
			'edit' => $this->handler('edit'),
			'save' => $this->handler('save'),
			'view' => $this->handler('view'),
			'publish' => $this->handler('publish'),
			'delete' => $this->handler('delete')
		]);
	}

	public function create(RespondArg $arg): mixed
	{
		if (!$this->canCreateRecipe($arg))
			return new Error(401, 'Not authorized');

		if (!$this->db->lock())
			return new Error(503, 'Service unavailable');

		try {
			if (
				!$arg->userCan('create_unlimited_recipes')
				&& $this->db->countOwnedRecipes($arg->uid()) >= self::MAX_RECIPES
			) {
				return new Error(400, 'Recipe limit reached.');
			}

			$id = $this->db->createRecipe(
				owner_uid: $arg->uid()
			);

			return new Redirect("/{$this->baseUri}/edit?id=$id");
		} finally {
			$this->db->unlock();
		}
	}

	public function edit(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		if (!$this->db->lock())
			return new Error(503, 'Service unavailable');

		try {
			$recipe = $this->db->loadRecipe($id);

			if (!$recipe)
				return new Error(404, 'Recipe not found');

			if (!$this->canEditRecipe($arg, $recipe))
				return new Error(401, 'Not authorized');


			$token = SaveToken::tryReserveEncoded($arg->uid(), $recipe['save_token']);
			if (!$token) {
				$currentToken = SaveToken::decode($recipe['save_token']);
				$uname = $arg->username($currentToken->userId);
				return new Error(409, "This recipe is currently being edited by $uname. Try again later.");
			}

			$recipe['save_token'] = $token->encode();
			$this->db->saveRecipe($recipe);

			ReactPage::render(
				$arg,
				title: 'Edit recipe',
				scripts: ["/{$this->baseUri}/assets/recipeEdit.js"],
				model: [
					'recipe' => $recipe,
					'courses' => self::COURSES,
					'saveUri' => "/{$this->baseUri}/save",
					'viewUri' => "/{$this->baseUri}/view?id=$id",
					'deleteUri' => "/{$this->baseUri}/delete",
					'publishUri' => "/{$this->baseUri}/publish",
					'initialSaveKey' => $token->key,
					'titleField' => self::titleField()->toJson(),
					'courtesyOfField' => self::courtesyOfField()->toJson(),
					'notesField' => self::notesField()->toJson(),
					'ingredientField' => self::ingredientField()->toJson(),
					'directionField' => self::directionField()->toJson(),
					'maxListEntries' => self::MAX_LIST_ENTRIES,
				]
			);
			return null;
		} finally {
			$this->db->unlock();
		}
	}

	public function publish(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		if (!$this->db->lock())
			return new Error(503, 'Service unavailable');

		try {
			$recipe = $this->db->loadRecipe($id);

			if (!$recipe)
				return new Error(404, 'Recipe not found');

			if (!$this->canEditRecipe($arg, $recipe))
				return new Error(401, 'Not authorized');

			$recipe['is_published'] = !!\intval($_REQUEST['publish']);
			$this->db->saveRecipe($recipe);

			return new Redirect("/{$this->baseUri}/view?id=$id");
		} finally {
			$this->db->unlock();
		}
	}

	public function delete(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		if (!$this->db->lock())
			return new Error(503, 'Service unavailable');

		try {
			$recipe = $this->db->loadRecipe($id);

			if (!$recipe)
				return new Error(404, 'Recipe not found');

			if (!$this->canEditRecipe($arg, $recipe))
				return new Error(401, 'Not authorized');

			$this->db->deleteRecipe($id);

			return new Redirect("/{$this->baseUri}/my_recipes");
		} finally {
			$this->db->unlock();
		}
	}

	public function save(RespondArg $arg): mixed
	{
		$req = $arg->parseBody(RecipeSaveRequest::class);
		if (!$req)
			return new JsonError(400, 'Bad recipe encoding');

		if (!$this->db->lock())
			return new JsonError(503, 'Service unavailable');

		try {
			$recipe = $req->recipe;
			$id = $recipe->id;

			$existing = $this->db->loadRecipe($id);
			if (!$existing)
				return new JsonError(404, 'Recipe not found');

			if (!$this->canEditRecipe($arg, $existing))
				return new JsonError(401, 'Not authorized');

			if (!self::titleField()->isValid($recipe->title)) {
				return new JsonError(400, 'Bad title format');
			}
			$recipe->title = normalizeLine($recipe->title);

			$recipe->courtesyOf = normalizeLine($recipe->courtesyOf);
			if (!self::courtesyOfField()->isValid($recipe->courtesyOf)) {
				return new JsonError(400, 'Bad "courtesy of" format');
			}

			$recipe->notes = normalizeLine($recipe->notes);
			if (!self::notesField()->isValid($recipe->notes)) {
				return new JsonError(400, 'Bad "notes" format');
			}

			if ($recipe->course < 1 || $recipe->course > count(self::COURSES)) {
				return new JsonError(400, 'Bad course');
			}

			if (\count($recipe->ingredients->elems) > self::MAX_LIST_ENTRIES) {
				return new JsonError(400, 'Too many ingredients');
			}

			$existingIngredients = [];
			foreach ($existing['ingredients'] as $ing) {
				$existingIngredients[$ing['id']] = true;
			}

			foreach ($recipe->ingredients->deletedIds as $ingId) {
				if (!\array_key_exists($ingId, $existingIngredients))
					return new JsonError(400, 'Bad deleted ingredient id');
			}

			foreach ($recipe->ingredients->elems as $ing) {
				if (!self::ingredientField()->isValid($ing->value))
					return new JsonError(400, 'Bad ingredient format');

				$ing->value = normalizeLine($ing->value);

				if (!$ing->isTemp && !\array_key_exists($ing->id, $existingIngredients))
					return new JsonError(400, 'Bad saved ingredient id');
			}

			if (\count($recipe->directions->elems) > self::MAX_LIST_ENTRIES) {
				return new JsonError(400, 'Too many directions');
			}

			$existingDirections = [];
			foreach ($existing['directions'] as $dir) {
				$existingDirections[$dir['id']] = true;
			}

			foreach ($recipe->directions->deletedIds as $dirId) {
				if (!\array_key_exists($dirId, $existingDirections))
					return new JsonError(400, 'Bad deleted direction id');
			}

			foreach ($recipe->directions->elems as $dir) {
				if (!self::directionField()->isValid($dir->value))
					return new JsonError(400, 'Bad direction format');

				$dir->value = normalizeLine($dir->value);

				if (!$dir->isTemp && !\array_key_exists($dir->id, $existingDirections))
					return new JsonError(400, 'Bad saved direction id');
			}

			$token = SaveToken::tryReserveEncoded(
				$arg->uid(),
				$existing['save_token'],
				$req->saveKey ?? 'bad key'
			);

			if (!$token) {
				$currentToken = SaveToken::decode($existing['save_token']);
				$uname = $arg->username($currentToken->userId);
				return new JsonError(409, "This recipe was recently edited by '{$uname}' and the information you see may be inaccurate. You will not be able to edit this recipe until you successfully reload the page.");
			}

			// DONE VALIDATING. DO REQUESTED SAVE

			foreach ($recipe->ingredients->deletedIds as $ingId) {
				$this->db->deleteIngredient($ingId);
			}

			$mappedIngredients = [];
			$ingredients = [];

			foreach ($recipe->ingredients->elems as $ing) {
				$ingId = $ing->id;
				if ($ing->isTemp) {
					$ingId = $this->db->createIngredient($id);
					$mappedIngredients[$ing->id] = $ingId;
				}

				array_push($ingredients, [
					'id' => $ingId,
					'value' => $ing->value,
				]);
			}

			foreach ($recipe->directions->deletedIds as $dirId) {
				$this->db->deleteDirection($dirId);
			}

			$mappedDirections = [];
			$directions = [];

			foreach ($recipe->directions->elems as $dir) {
				$dirId = $dir->id;
				if ($dir->isTemp) {
					$dirId = $this->db->createDirection($id);
					$mappedDirections[$dir->id] = $dirId;
				}

				array_push($directions, [
					'id' => $dirId,
					'value' => $dir->value,
				]);
			}

			$recipeToSave = [
				'id' => $id,
				'title' => $recipe->title,
				'is_vegan' => \intval($recipe->isVegan),
				'is_published' => \intval($recipe->isPublished),
				'course' => $recipe->course,
				'notes' => $recipe->notes ? $recipe->notes : null,
				'courtesy_of' => $recipe->courtesyOf ? $recipe->courtesyOf : null,
				'ingredients' => $ingredients,
				'directions' => $directions,
				'save_token' => $token->encode()
			];

			$this->db->saveRecipe($recipeToSave);

			return new JsonSuccess([
				'mappedIngredients' => $mappedIngredients,
				'mappedDirections' => $mappedDirections,
				'newSaveKey' => $token->key,
			]);
		} finally {
			$this->db->unlock();
		}
	}

	public function myRecipes(RespondArg $arg): mixed
	{
		$recipes = [];

		$can_create = $this->canCreateRecipe($arg);

		if ($can_create) {
			$recipes = $this->db->loadMyRecipes($arg->uid());
		}

		$arg->renderPage(
			title: 'My Recipes',
			template: __DIR__ . '/my_recipes_page.php',
			args: [
				'is_logged_in' => $arg->isLoggedIn(),
				'can_create' => $can_create,
				'recipes' => $recipes
			]
		);

		return null;
	}

	public function selectPublished(RespondArg $arg): mixed
	{
		$recipes = $this->db->loadPublishedRecipes();

		$arg->renderPage(
			title: 'Recipes',
			template: __DIR__ . '/recipe_page.php',
			args: [
				'recipes' => $recipes
			]
		);

		return null;
	}

	public function view(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		$recipe = $this->db->loadRecipe($id);
		if (!($recipe && $this->canViewRecipe($arg, $recipe)))
			return new Error(404, 'Not found');

		$can_edit = $this->canEditRecipe($arg, $recipe);

		$arg->renderPage(
			title: $recipe['title'],
			template: __DIR__ . '/view_recipe.php',
			args: [
				'recipe' => $recipe,
				'can_edit' => $can_edit
			]
		);
		return null;
	}

	private static function titleField(): InputField
	{
		return new InputField(
			required: true,
			maxLength: 128,
			pattern: '.*\S+.*',
			title: "Enter the recipe's title. It must have at least one character."
		);
	}

	private static function courtesyOfField(): InputField
	{
		return new InputField(
			required: false,
			maxLength: 64,
			title: "Who gave you this recipe?"
		);
	}

	private static function notesField(): InputField
	{
		return new InputField(
			required: false,
			maxLength: 512,
			title: "Additional notes"
		);
	}

	private static function ingredientField(): InputField
	{
		return new InputField(
			required: true,
			maxLength: 128,
			pattern: '.*\S+.*',
			title: "Edit the selected ingredient."
		);
	}

	private static function directionField(): InputField
	{
		return new InputField(
			required: true,
			maxLength: 256,
			pattern: '.*\S+.*',
			title: "Edit the selected direction."
		);
	}
}

class JsonSuccess extends Responder
{
	public function __construct(
		public array $body
	) {
	}

	public function respond(RespondArg $arg): mixed
	{
		\header('Content-Type: application/json');
		echo \json_encode($this->body);
		return null;
	}
}

class JsonError extends Responder
{
	public function __construct(
		public int $code,
		public ?string $msg = null
	) {
	}

	public function respond(RespondArg $arg): mixed
	{
		\http_response_code($this->code);
		\header('Content-Type: application/json');
		echo \json_encode(['error' => $this->msg]);
		return null;
	}
}

class EditableElem
{
	public bool $isTemp;
	public int $id;
	public string $value;
}

class EditableArray
{
	public int $selectedIndex;

	#[ArrayProperty(EditableElem::class)]
	public array $elems;

	#[ArrayProperty('int')]
	public array $deletedIds;
}

class EditableRecipe
{
	public int $id;
	public string $title;
	public bool $isVegan;
	public bool $isPublished;
	public int $course;
	public string $notes;
	public string $courtesyOf;
	public EditableArray $ingredients;
	public EditableArray $directions;
}

class RecipeSaveRequest
{
	public EditableRecipe $recipe;
	public string $saveKey;
}

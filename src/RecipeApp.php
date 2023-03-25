<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\App;
use Gulachek\Bassline\Semver;
use Gulachek\Bassline\RespondArg;
use Gulachek\Bassline\Redirect;
use Gulachek\Bassline\Responder;
use Gulachek\Bassline\ArrayProperty;

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

	public function __construct(
		string $dbPath,
		private string $baseUri
	)
	{
		parent::__construct(__DIR__ . '/..');
		$this->db = RecipeDatabase::fromPath($dbPath);
	}

	public function title(): string
	{
		return 'Recipe';
	}

	public function version(): Semver
	{
		return new Semver(0,1,0);
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
			 */
		];
	}

	public function capabilities(): array
	{
		return [
			'edit_recipe' => [
				'description' => 'User can create and edit recipes created by himself.'
			],
			'edit_any_recipe' => [
				'description' => 'User can create and edit any recipe, including those created by others. Overrides edit_recipe.'
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
	): bool
	{
		if ($arg->userCan('edit_any_recipe'))
			return true;

		if (!$arg->userCan('edit_recipe'))
			return false;

		return $arg->uid() === $recipe['owner_uid'];
	}

	public function respond(RespondArg $arg): mixed
	{
		return $arg->route([
			'.' => $this->handler('selectPublished'),
			'my_recipes' => $this->handler('myRecipes'),
			'create' => $this->handler('create'),
			'edit' => $this->handler('edit'),
			'save' => $this->handler('save'),
			'view' => $this->handler('view')
		]);
	}

	public function create(RespondArg $arg): mixed
	{
		if (!$this->canCreateRecipe($arg))
			return new Error(401, 'Not authorized');

		$id = $this->db->createRecipe(
			owner_uid: $arg->uid()
		);

		return new Redirect("/{$this->baseUri}/edit?id=$id");
	}

	// TODO: verify user actually owns recipe
	public function edit(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		$recipe = $this->db->loadRecipe($id);

		if (!$recipe)
			return new Error(404, 'Recipe not found');

		if (!$this->canEditRecipe($arg, $recipe))
			return new Error(401, 'Not authorized');

		ReactPage::render($arg,
			title: 'Edit recipe',
			scripts: ["/{$this->baseUri}/assets/recipeEdit.js"],
			model: [
				'recipe' => $recipe,
				'courses' => self::COURSES,
				'saveUri' => "/{$this->baseUri}/save"
			]
		);
		return null;
	}

	public function save(RespondArg $arg): mixed
	{
		$req = $arg->parseBody(RecipeSaveRequest::class);
		if (!$req)
			return new JsonError(400, 'Bad recipe encoding');

		$recipe = $req->recipe;
		$id = $recipe->id;

		$existing = $this->db->loadRecipe($id);
		if (!$existing)
			return new JsonError(404, 'Recipe not found');

		if (!$this->canEditRecipe($arg, $existing))
			return new JsonError(401, 'Not authorized');

		if ($recipe->course < 1 || $recipe->course > count(self::COURSES))
		{
			return new JsonError(400, 'Bad course');
		}

		$existingIngredients = [];
		foreach ($existing['ingredients'] as $ing)
		{
			$existingIngredients[$ing['id']] = true;
		}

		foreach ($recipe->ingredients->deletedIds as $ingId)
		{
			if (!\array_key_exists($ingId, $existingIngredients))
				return new JsonError(400, 'Bad deleted ingredient id');
		}

		foreach ($recipe->ingredients->elems as $ing)
		{
			if (!$ing->isTemp && !\array_key_exists($ing->id, $existingIngredients))
				return new JsonError(400, 'Bad saved ingredient id');
		}

		$existingDirections = [];
		foreach ($existing['directions'] as $dir)
		{
			$existingDirections[$dir['id']] = true;
		}

		foreach ($recipe->directions->deletedIds as $dirId)
		{
			if (!\array_key_exists($dirId, $existingDirections))
				return new JsonError(400, 'Bad deleted direction id');
		}

		foreach ($recipe->directions->elems as $dir)
		{
			if (!$dir->isTemp && !\array_key_exists($dir->id, $existingDirections))
				return new JsonError(400, 'Bad saved direction id');
		}

		// DONE VALIDATING. DO REQUESTED SAVE

		foreach ($recipe->ingredients->deletedIds as $ingId)
		{
			$this->db->deleteIngredient($ingId);
		}

		$mappedIngredients = [];
		$ingredients = [];

		foreach ($recipe->ingredients->elems as $ing)
		{
			$ingId = $ing->id;
			if ($ing->isTemp)
			{
				$ingId = $this->db->createIngredient($id);
				$mappedIngredients[$ing->id] = $ingId;
			}

			array_push($ingredients, [
				'id' => $ingId,
				'value' => $ing->value,
			]);
		}

		foreach ($recipe->directions->deletedIds as $dirId)
		{
			$this->db->deleteDirection($dirId);
		}

		$mappedDirections = [];
		$directions = [];

		foreach ($recipe->directions->elems as $dir)
		{
			$dirId = $dir->id;
			if ($dir->isTemp)
			{
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
			'directions' => $directions
		];

		$this->db->saveRecipe($recipeToSave);

		return new JsonSuccess([
			'mappedIngredients' => $mappedIngredients,
			'mappedDirections' => $mappedDirections
		]);
	}

	public function myRecipes(RespondArg $arg): mixed
	{
		$recipes = [];

		$can_create = $this->canCreateRecipe($arg);

		if ($can_create)
		{
			$recipes = $this->db->loadMyRecipes($arg->uid());
		}

		$arg->renderPage([
			'title' => 'My Recipes',
			'template' => __DIR__ . '/my_recipes_page.php',
			'args' => [
				'is_logged_in' => $arg->isLoggedIn(),
				'can_create' => $can_create,
				'recipes' => $recipes
			]
		]);

		return null;
	}

	public function selectPublished(RespondArg $arg): mixed
	{
		$recipes = $this->db->loadPublishedRecipes();

		$arg->renderPage([
			'title' => 'Recipes',
			'template' => __DIR__ . '/recipe_page.php',
			'args' => [
				'recipes' => $recipes
			]
		]);

		return null;
	}

	public function view(RespondArg $arg): mixed
	{
		$id = \intval($_REQUEST['id']);

		$recipe = $this->db->loadRecipe($id);
		if (!$recipe)
			return new Error(404, 'Not found');

		$can_edit = $this->canEditRecipe($arg, $recipe);

		$arg->renderPage([
			'title' => $recipe['title'],
			'template' => __DIR__ . '/view_recipe.php',
			'args' => [
				'recipe' => $recipe,
				'can_edit' => $can_edit
			]
		]);
		return null;
	}
}

class JsonSuccess extends Responder
{
	public function __construct(
		public array $body
	)
	{
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
	)
	{
	}

	public function respond(RespondArg $arg): mixed
	{
		\http_response_code($this->code);
		\header('Content-Type: application/json');
		echo \json_encode([ 'error' => $this->msg ]);
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
}

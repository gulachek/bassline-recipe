<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\Database;

class RecipeDatabase
{
	public function __construct(
		private Database $db
	)
	{
		$this->db->mountNamedQueries(__DIR__ . '/../sql');
	}

	static function fromPath(string $path): RecipeDatabase
	{
		return new RecipeDatabase(new Database(new \Sqlite3($path)));
	}

	public function install(): ?string
	{
		$this->db->exec('init');
		return null;
	}

	public function createRecipe(
		int $owner_uid
	): int
	{
		$this->db->query('create-recipe', [
			':owner' => $owner_uid
		]);

		$id = $this->db->lastInsertRowID();

		$this->createIngredient($id);
		$this->createDirection($id);

		return $id;
	}

	public function loadRecipe(
		int $id
	): ?array
	{
		$recipe = $this->db->queryRow('load-recipe', $id);
		if (!$recipe)
			return null;

		$recipe['ingredients'] = [];
		$ingredients = $this->db->query('load-ingredients', $id);
		foreach ($ingredients->rows() as $row)
			array_push($recipe['ingredients'], $row);

		$recipe['directions'] = [];
		$directions = $this->db->query('load-directions', $id);
		foreach ($directions->rows() as $row)
			array_push($recipe['directions'], $row);

		return $recipe;
	}

	public function saveRecipe(array $recipe): void
	{
		$this->db->query('save-recipe', [
			':id' => $recipe['id'],
			':title' => $recipe['title'],
			':is_vegan' => $recipe['is_vegan'],
			':is_published' => $recipe['is_published'],
			':course' => $recipe['course'],
			':notes' => $recipe['notes'],
			':courtesy_of' => $recipe['courtesy_of']
		]);

		$i = 0;
		foreach ($recipe['ingredients'] as $ing)
		{
			$this->db->query('save-ingredient', [
				':order' => ++$i,
				':id' => $ing['id'],
				':value' => $ing['value']
			]);
		}

		$i = 0;
		foreach ($recipe['directions'] as $dir)
		{
			$this->db->query('save-direction', [
				':order' => ++$i,
				':id' => $dir['id'],
				':value' => $dir['value']
			]);
		}
	}

	public function createIngredient(int $recipe_id): int
	{
		$this->db->query('create-ingredient', [
			':recipe' => $recipe_id
		]);
		return $this->db->lastInsertRowID();
	}

	public function deleteIngredient(int $id): void
	{
		$this->db->query('delete-ingredient', $id);
	}

	public function createDirection(int $recipe_id): int
	{
		$this->db->query('create-direction', [
			':recipe' => $recipe_id
		]);
		return $this->db->lastInsertRowID();
	}

	public function deleteDirection(int $id): void
	{
		$this->db->query('delete-direction', $id);
	}

	public function loadMyRecipes(int $uid): array
	{
		$rows = [];
		$result = $this->db->query('load-my-recipes', [
			':uid' => $uid
		]);	

		foreach ($result->rows() as $row)
			array_push($rows, $row);

		return $rows;
	}

	public function loadPublishedRecipes(): array
	{
		$rows = [];
		$result = $this->db->query('load-published-recipes');	

		foreach ($result->rows() as $row)
			array_push($rows, $row);

		return $rows;
	}
}

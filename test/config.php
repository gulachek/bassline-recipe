<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\Config;
use Gulachek\Bassline\RespondArg;
use Gulachek\Bassline\Redirect;

class TestConfig extends Config
{
	public function __construct() { }

	public function apps(): array
	{
		$data = $this->dataDir();

		return [
			'recipe' => new RecipeApp(
				baseUri: "recipe",
				dbPath: "$data/recipe.db"
			)
		];
	}

	public function siteName(): string
	{
		return 'Test Recipe Website';
	}

	public function dataDir(): string
	{
		$dir = getenv('DATA_DIR');
		if ($dir)
			return $dir;

		return __DIR__ . '/data/playground';
	}

	public function landingPage(RespondArg $arg): mixed
	{
		return new Redirect('/recipe/');
	}
}

return new TestConfig();

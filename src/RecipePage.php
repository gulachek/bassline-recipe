<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\RespondArg;
use Gulachek\Bassline\Responder;

class RecipePage extends Responder
{
	public function respond(RespondArg $arg): mixed
	{
		$path = $arg->path;

		if ($path->count() > 1)
			return new Error(404, 'Not found');

		$action = $path->isRoot() ? 'select' : $path->at(0);

		if ($action === 'select')
			return $this->select($arg);

		return new Error(400, 'Bad action');
	}

	private function select(RespondArg $arg): mixed
	{
		$arg->renderPage([
			'title' => 'Recipes',
			'template' => __DIR__ . '/recipe_page.php'
		]);
		return null;
	}
}

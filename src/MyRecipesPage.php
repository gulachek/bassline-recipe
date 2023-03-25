<?php

namespace Gulachek\Recipe;

use Gulachek\Bassline\RespondArg;
use Gulachek\Bassline\Responder;

class MyRecipesPage extends Responder
{
	public function respond(RespondArg $arg): mixed
	{
		$arg->renderPage([
			'title' => 'My Recipes',
			'template' => __DIR__ . '/my_recipes_page.php',
			'args' => [
				'is_logged_in' => $arg->isLoggedIn(),
				'can_edit' => $arg->userCan('edit_recipe')
			]
		]);
		return null;
	}
}

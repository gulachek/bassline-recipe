<?php

namespace Gulachek\Recipe;

use \Gulachek\Bassline\RespondArg;

class ReactPage
{
	public static function render(
		RespondArg $arg, 
		string $title,
		array $scripts,
		array $model
	): mixed
	{
		return $arg->renderPage(
			title: $title,
			template: __DIR__ . '/react_page.php',
			args: [
				'model' => $model,
				'scripts' => $scripts
			]
		);
	}
}

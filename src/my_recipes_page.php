<h1> My Recipes </h1>

<link type="text/css" rel="stylesheet"
	href="<?=$URI->abs('/assets/my_recipes.css')?>" />

<?php if ($TEMPLATE['can_create']): ?>

<?php if (count($TEMPLATE['recipes'])): ?>

	<p> <em> Select a recipe to edit </em> </p>

	<?php foreach ($TEMPLATE['recipes'] as $recipe): ?>
	<div>
		<a href="<?=$URI->abs('/edit', ['id' => $recipe['id']])?>">
			<?=text($recipe['title'])?>
			<?php if (!$recipe['is_published']) echo '(draft)'; ?>
		</a>
	</div>
	<?php endforeach; ?>

<?php endif; ?>

<p>
	<form method="POST" action="<?=$URI->abs('/create')?>">
	<button> Create New Recipe </button>
	</form>
</p>

<?php elseif ($TEMPLATE['is_logged_in']): ?>

<p>
You are not allowed to create or edit recipes.
</p>

<?php else: ?>

<p>
You must <a href="/login/"> log in </a> to see your recipes.
</p>

<?php endif; ?>

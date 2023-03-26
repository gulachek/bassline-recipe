<h1> My Recipes </h1>

<?php if ($TEMPLATE['can_create']): ?>

<?php if (count($TEMPLATE['recipes'])): ?>

	<h2> Select a recipe to edit </h2>

	<?php foreach ($TEMPLATE['recipes'] as $recipe): ?>
	<div>
		<a href="<?=$URI->abs('/edit', ['id' => $recipe['id']])?>">
			<?=text($recipe['title'])?>
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

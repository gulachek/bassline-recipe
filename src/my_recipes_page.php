<h1> My Recipes </h1>

<?php if ($TEMPLATE['can_create']): ?>

<?php foreach ($TEMPLATE['recipes'] as $recipe): ?>
<div>
	<a href="<?=$URI->abs('/edit', ['id' => $recipe['id']])?>">
		<?=text($recipe['title'])?>
	</a>
</div>
<?php endforeach; ?>

<form method="POST" action="<?=$URI->abs('/create')?>">
<button> Create New </button>
</form>

<?php elseif ($TEMPLATE['is_logged_in']): ?>

<p>
You are not allowed to create or edit recipes.
</p>

<?php else: ?>

<p>
You must <a href="/login/"> log in </a> to see your recipes.
</p>

<?php endif; ?>

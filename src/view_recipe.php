<?php $r = $TEMPLATE['recipe']; ?>
<link rel="stylesheet" type="text/css" href="<?=$URI->abs('/assets/view_recipe.css')?>" />

<?php if (!$r['is_published']): ?>
<p><em>
This is a preview of a draft. Only those who can edit this recipe will be able to access this preview.  To make the recipe visible to anyone, publish it.
</em></p>
<?php endif; ?>

<h1> <?=text($r['title'])?> </h1>

<?php if ($r['courtesy_of']): ?>
<p> <em> Courtesy of <?=text($r['courtesy_of'])?> </em> </p>
<?php endif; ?>

<div class="ingredients">
	<h2> Ingredients </h2>

	<ul>
		<?php foreach ($r['ingredients'] as $ing): ?>
			<li> <?=text($ing['value'])?> </li>
		<?php endforeach; ?>
	</ul>
</div>

<div class="directions">
	<h2> Directions </h2>

	<ol>
		<?php foreach ($r['directions'] as $dir): ?>
			<li> <?=text($dir['value'])?> </li>
		<?php endforeach; ?>
	</ol>
</div>

<?php if ($r['notes']): ?>
<div class="notes">
	<h2> Notes </h2>
	<p> <em> <?=text($r['notes'])?> </em> </p>
</div>
<?php endif; ?>

<?php if ($TEMPLATE['can_edit']): ?>
<form class="actions">
	<input type="hidden" name="id" value="<?=$r['id']?>" />

	<button formmethod="GET" formaction="<?=$URI->abs('/edit')?>">
		Edit Recipe
	</button>

	<button
		formmethod="POST"
		formaction="<?=$URI->abs('/publish')?>"
		name="publish"
		value="<?=\intval(!$r['is_published'])?>"
	>
		<?=$r['is_published'] ? 'Hide' : 'Publish'?> Recipe
	</button>
</form>
<?php endif; ?>


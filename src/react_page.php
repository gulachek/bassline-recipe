<script src="<?=$URI->abs('/assets/react.js')?>"></script>
<?php foreach ($TEMPLATE['scripts'] as $script): ?>
	<script src="<?=text($script)?>"></script>
<?php endforeach; ?>

<script id="page-model" type="application/json">
<?php /* json_encode escapes slashes by default */ ?>
<?=json_encode($TEMPLATE['model'])?>
</script>

<div id="page-view">
</div>

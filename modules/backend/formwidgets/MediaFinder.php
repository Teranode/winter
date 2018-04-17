<?php namespace Backend\FormWidgets;

use System\Classes\MediaLibrary;
use Backend\Classes\FormField;
use Backend\Classes\FormWidgetBase;

/**
 * Media Finder
 * Renders a record finder field.
 *
 *    image:
 *        label: Some image
 *        type: mediafinder
 *        mode: image
 *        maxItems: false
 *        imageWidth: 200px
 *        imageHeight: 200px
 *        prompt: Click the %s button to pick an image
 *
 * @package october\backend
 * @author Alexey Bobkov, Samuel Georges
 */
class MediaFinder extends FormWidgetBase
{
    //
    // Configurable properties
    //

    /**
     * @var string Prompt to display if no record is selected.
     */
    public $prompt = 'backend::lang.mediafinder.default_prompt';

    /**
     * @var string Display mode for the selection. Values: file, image.
     */
    public $mode = 'file';

    /**
     * @var mixed Max number of items to select.
     * Values:
     *      false (disabled, only one item)
     *      -1 (infinite number of items - null is not an option because it will be filtered out by getConfig()),
     *      +integer (number of items to limit selection to)
     */
    public $maxItems = false;

    /**
     * @var int Preview image width
     */
    public $imageWidth;

    /**
     * @var int Preview image height
     */
    public $imageHeight;

    //
    // Object properties
    //

    /**
     * @inheritDoc
     */
    protected $defaultAlias = 'media';

    /**
     * @inheritDoc
     */
    public function init()
    {
        $this->fillFromConfig([
            'mode',
            'prompt',
            'maxItems',
            'imageWidth',
            'imageHeight',
        ]);

        if ($this->formField->disabled) {
            $this->previewMode = true;
        }
    }

    /**
     * @inheritDoc
     */
    public function render()
    {
        $this->prepareVars();

        return $this->makePartial('mediafinder');
    }

    /**
     * Prepares the list data
     */
    public function prepareVars()
    {
        $value = $this->getLoadValue();
        $isImage = $this->mode === 'image';

        $this->vars['value'] = $value;
        $this->vars['imageUrl'] = $isImage && $value ? MediaLibrary::url($value) : '';
        $this->vars['imageExists'] = $isImage && $value ? MediaLibrary::instance()->exists($value) : '';
        $this->vars['field'] = $this->formField;
        $this->vars['prompt'] = str_replace('%s', '<i class="icon-folder"></i>', trans($this->prompt));
        $this->vars['mode'] = $this->mode;
        $this->vars['maxItems'] = $this->maxItems;
        $this->vars['imageWidth'] = $this->imageWidth;
        $this->vars['imageHeight'] = $this->imageHeight;
    }

    /**
     * @inheritDoc
     */
    public function getSaveValue($value)
    {
        if ($this->formField->disabled || $this->formField->hidden) {
            return FormField::NO_SAVE_DATA;
        }

        if ($this->maxItems !== false) {
            throw new \Exception("Max Items handling enabled");
        }

        return $value;
    }

    /**
     * @inheritDoc
     */
    protected function loadAssets()
    {
        $this->addJs('js/mediafinder.js', 'core');
        $this->addCss('css/mediafinder.css', 'core');
    }
}

/**
 * Overall class containing the ready logic
 */
 class ItemsWithRollTables5e {
  static MODULE_NAME = "items-with-rolltables-5e";
  static MODULE_TITLE = "Items with Rollable Tables DnD5e";

  static setup = () => {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);
    Hooks.on('renderChatLog', ItemsWithRollTables5eChat.activateListeners);
  }

  static ready = async () => {
    Hooks.on('renderItemSheet5e', ItemsWithRollTables5eItemSheet.handleRender);
    Hooks.on('Item5e.displayCard', ItemsWithRollTables5eItem.handleDisplayCard);
    Hooks.on('renderChatPopout', ItemsWithRollTables5eChat.activateListeners);
  }
}

Hooks.on("setup", ItemsWithRollTables5e.setup);
Hooks.on("ready", ItemsWithRollTables5e.ready);

/**
 * Contains all logic related to the ItemSheet
 */
class ItemsWithRollTables5eItemSheet {
  /**
   * Handles injecting the DOM in the item sheet
   * @param {*} itemSheet 
   * @param {*} html 
   */
  static injectDom = async (itemSheet, html) => {
    const item = itemSheet.item;
    const currentValue = item.getFlag(ItemsWithRollTables5e.MODULE_NAME, 'rollable-table-uuid');

    let input = `<input disabled type='text' placeholder="${game.i18n.localize(`${ItemsWithRollTables5e.MODULE_NAME}.input-placeholder`)}" />`

    let link;

    if (currentValue) {
      const document = await fromUuid(currentValue);

      if (document.pack) {
        link = `@Compendium[${document.pack}.${document.id}]{${document.name}}`;
      } else {
        link = document.link;
      }
    }

    if (link) {
      link = TextEditor.enrichHTML(link);
    }

    let domToInject = `
    <div class='form-group'>
      <label>${game.i18n.localize(`${ItemsWithRollTables5e.MODULE_NAME}.input-label`)}</label>
      <div class="form-fields rollable-table-drop-target">
        ${!!link ? link : input}
        ${!!currentValue ? `<a class="damage-control rolltable-control clear" title="${game.i18n.localize(`${ItemsWithRollTables5e.MODULE_NAME}.clear-title`)}"><i class="fa fa-times"></i></a>` : ""}
      </div>
    </div>
    `

    const el = html.find('[name="data.formula"]').first().parents('.form-group');
    el.after(domToInject);

    itemSheet.setPosition();
  }

  static _onDrop = (item) => async (event) => {
    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      return false;
    }

    if (data.type !== 'RollTable') return false;

    const document = await RollTable.fromDropData(data);

    if (!document) return false;

    item.setFlag(ItemsWithRollTables5e.MODULE_NAME, 'rollable-table-uuid', document.uuid);
  }

  static activateListeners = (itemSheet, html) => {
    const item = itemSheet.item;

    const dragDrop = new DragDrop({
      dropSelector: '.rollable-table-drop-target',
      permissions: { drop: itemSheet._canDragDrop.bind(itemSheet) },
      callbacks: { drop: this._onDrop(item) }
    });

    dragDrop.bind(html[0]);

    // set up clear button
    html.on('click', 'a.rolltable-control.clear', () => {
      item.unsetFlag(ItemsWithRollTables5e.MODULE_NAME, 'rollable-table-uuid');
    })
  }

  /**
   * renderItemSheet Hook callback
   * Injects the input for selecting a resouce to override
   * @param {*} itemSheet 
   * @param {*} html 
   * @returns 
   */
  static handleRender = async (itemSheet, html, options) => {
    await this.injectDom(itemSheet, html);

    this.activateListeners(itemSheet, html);

    // notify other modules we are done adding to the sheet (used by MRE to add the auto roll checkboxes)
    Hooks.callAll(`${ItemsWithRollTables5e.MODULE_NAME}.sheetMutated`, itemSheet, html, options);
  }
}

/**
 * Contains all logic related to the Item document
 */
 class ItemsWithRollTables5eItem {
  /**
   * displayCard hook callback
   * Updates the chatmessage created or Mutates the chatMessage data
   * @param {*} item 
   * @param {*} chatMessage - Either a ChatMessage document that was created or the data needed to create one
   * @returns 
   */
  static handleDisplayCard = (item, chatMessage) => {
    const tableUuid = item.getFlag(ItemsWithRollTables5e.MODULE_NAME, 'rollable-table-uuid');

    if (!tableUuid) return;

    let chatMessageData;
    if (chatMessage instanceof ChatMessage) {
      chatMessageData = chatMessage.data;
    } else {
      chatMessageData = chatMessage;
    }

    const mutatedContent = $(chatMessageData.content);

    mutatedContent
      .find('.card-buttons')
      .append(`<button data-action="rolltable">${game.i18n.localize('DOCUMENT.RollTable')}</button>`);

    const updateData = {
      content: mutatedContent.prop('outerHTML'),
      flags: {
        [ItemsWithRollTables5e.MODULE_NAME]: {
          'rollable-table-uuid': tableUuid
        }
      }
    };

    if (chatMessage instanceof ChatMessage) {
      chatMessage.update(updateData);
    } else {
      // mutates chatMessage
      foundry.utils.mergeObject(chatMessage, updateData);
    }
  }
}


class ItemsWithRollTables5eChat {
  static activateListeners = (_chatLog, html) => {
    html.on('click', 'button[data-action="rolltable"]', this.handleButtonClick)
  }

  static handleButtonClick = async (event) => {
    const button = event.currentTarget;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message = game.messages.get(messageId);

    const tableUuid = message.getFlag(ItemsWithRollTables5e.MODULE_NAME, 'rollable-table-uuid');

    if (!tableUuid) return;

    const rollableTable = await fromUuid(tableUuid);

    rollableTable.draw();
  }
}

// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { views, type ViewRegistry } from '@cacheplane/render';
import { A2uiTextComponent } from './text.component';
import { A2uiImageComponent } from './image.component';
import { A2uiIconComponent } from './icon.component';
import { A2uiDividerComponent } from './divider.component';
import { A2uiRowComponent } from './row.component';
import { A2uiColumnComponent } from './column.component';
import { A2uiCardComponent } from './card.component';
import { A2uiListComponent } from './list.component';
import { A2uiButtonComponent } from './button.component';
import { A2uiTextFieldComponent } from './text-field.component';
import { A2uiCheckBoxComponent } from './check-box.component';
import { A2uiChoicePickerComponent } from './choice-picker.component';

export function a2uiBasicCatalog(): ViewRegistry {
  return views({
    Text: A2uiTextComponent,
    Image: A2uiImageComponent,
    Icon: A2uiIconComponent,
    Divider: A2uiDividerComponent,
    Row: A2uiRowComponent,
    Column: A2uiColumnComponent,
    Card: A2uiCardComponent,
    List: A2uiListComponent,
    Button: A2uiButtonComponent,
    TextField: A2uiTextFieldComponent,
    CheckBox: A2uiCheckBoxComponent,
    ChoicePicker: A2uiChoicePickerComponent,
  });
}

// SPDX-License-Identifier: MIT
import { views, type ViewRegistry } from '@cacheplane/render';
import { A2uiAudioPlayerComponent } from './audio-player.component';
import { A2uiButtonComponent } from './button.component';
import { A2uiCardComponent } from './card.component';
import { A2uiCheckBoxComponent } from './check-box.component';
import { A2uiChoicePickerComponent } from './choice-picker.component';
import { A2uiColumnComponent } from './column.component';
import { A2uiDateTimeInputComponent } from './date-time-input.component';
import { A2uiDividerComponent } from './divider.component';
import { A2uiIconComponent } from './icon.component';
import { A2uiImageComponent } from './image.component';
import { A2uiListComponent } from './list.component';
import { A2uiModalComponent } from './modal.component';
import { A2uiRowComponent } from './row.component';
import { A2uiSliderComponent } from './slider.component';
import { A2uiTabsComponent } from './tabs.component';
import { A2uiTextComponent } from './text.component';
import { A2uiTextFieldComponent } from './text-field.component';
import { A2uiVideoComponent } from './video.component';

export function a2uiBasicCatalog(): ViewRegistry {
  return views({
    AudioPlayer: A2uiAudioPlayerComponent,
    Button: A2uiButtonComponent,
    Card: A2uiCardComponent,
    CheckBox: A2uiCheckBoxComponent,
    ChoicePicker: A2uiChoicePickerComponent,
    Column: A2uiColumnComponent,
    DateTimeInput: A2uiDateTimeInputComponent,
    Divider: A2uiDividerComponent,
    Icon: A2uiIconComponent,
    Image: A2uiImageComponent,
    List: A2uiListComponent,
    Modal: A2uiModalComponent,
    Row: A2uiRowComponent,
    Slider: A2uiSliderComponent,
    Tabs: A2uiTabsComponent,
    Text: A2uiTextComponent,
    TextField: A2uiTextFieldComponent,
    Video: A2uiVideoComponent,
  });
}

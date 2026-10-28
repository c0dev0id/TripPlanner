import { EditDialog, field, type DialogAction } from './EditDialog';

/** A dialog that asks for a name: of something new, or a new one for something that has one. */
export function NameDialog(props: { label: string; title: string; open: boolean; placeholder: string; initial?: string; submit: string; onClose: () => void; onSubmit: (name: string) => void; actions?: DialogAction[] }) {
  const submit = (form: FormData) => {
    const name = field(form, 'name');
    if (name) props.onSubmit(name);
  };
  return (
    <EditDialog label={props.label} title={props.title} open={props.open} onClose={props.onClose} onSubmit={submit} submit={props.submit} actions={props.actions}>
      <label>
        Name
        <input name="name" value={props.initial ?? ''} placeholder={props.placeholder} maxlength={200} required autofocus />
      </label>
    </EditDialog>
  );
}

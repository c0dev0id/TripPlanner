import { EditDialog } from './EditDialog';
import { field } from './form';

/** A dialog that asks for a name: of something new, or a new one for something that has one. */
export function NameDialog(props: { title: string; open: boolean; placeholder: string; initial?: string; submit?: string; onClose: () => void; onSubmit: (name: string) => void }) {
  const submit = (form: FormData) => {
    const name = field(form, 'name');
    if (name) props.onSubmit(name);
  };
  return (
    <EditDialog label={props.title} value={props.open || undefined} title={() => props.title} onClose={props.onClose} onSubmit={submit} submit={props.submit}>
      {() => (
        <label>
          Name
          <input name="name" value={props.initial ?? ''} placeholder={props.placeholder} maxlength={200} required />
        </label>
      )}
    </EditDialog>
  );
}

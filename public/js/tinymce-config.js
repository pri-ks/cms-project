tinymce.init({
    selector: 'textarea#post-content',
    height: 300,
    menubar: false,
    plugins: ['advlist', 'lists', 'link'],
    toolbar: 'undo redo | bold italic underline | alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | forecolor backcolor'
});
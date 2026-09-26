// Shared catalog: cards, navigation, and the lesson runner use the same entries.
window.mathLessons = [
  { id: '6.1A', title: 'Two groups make ten', description: 'Count each group. Put the numbers together.', skill: 'count-groups' },
  { id: '6.2A', title: 'How many more to ten?', description: 'Find the missing number to make ten.', skill: 'missing-addend' }
];
window.lessonHref = lesson => `lesson.html?lesson=${encodeURIComponent(lesson.id)}`;

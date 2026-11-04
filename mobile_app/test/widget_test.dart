import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:safedrive_app/main.dart';

void main() {
  testWidgets('SafeDrive App initial load smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const SafeDriveApp());
    await tester.pumpAndSettle();
    expect(find.text('SafeDrive AI'), findsWidgets);
  });
}

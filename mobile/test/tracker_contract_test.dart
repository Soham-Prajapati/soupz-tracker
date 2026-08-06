import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:soupz_tracker_mobile/contracts/tracker_contract.dart';
import 'package:soupz_tracker_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<JsonMap> fixture(String name) async =>
      jsonDecode(await rootBundle.loadString('assets/fixtures/$name'))
          as JsonMap;

  test('plan fixture consumes the shared v1 plan shape', () async {
    final plan = PlanContract.fromJson(await fixture('plan-v1.json'));
    expect(plan.id, 'pln_fixture');
    expect(plan.kind, 'habit');
    expect(plan.recurrences, hasLength(1));
  });

  test(
    'today resource produces the portable home-widget payload fixture',
    () async {
      final today = TodayResourceContract.fromJson(
        await fixture('today-v1.json'),
      );
      final payload = HomeWidgetPayload.fromToday(
        today,
        const AccentChoice.preset(AccentPreset.miso),
      );
      expect(payload.toJson(), await fixture('widget-v1.json'));
    },
  );

  test(
    'accent contract accepts named ingredient presets or custom hex only',
    () {
      expect(
        const AccentChoice.preset(AccentPreset.kombu).resolvedHex,
        '#2F8C86',
      );
      expect(
        AccentChoice.fromJson({'customHex': '#12abEF'}).resolvedHex,
        '#12ABEF',
      );
      expect(
        () => AccentChoice.fromJson({'customHex': 'blue'}),
        throwsFormatException,
      );
    },
  );

  test(
    'native capability boundary promises system impacts but no authored patterns',
    () {
      final ios = NativeCapabilityContract.forTarget(TargetPlatform.iOS);
      expect(ios.homeWidget, isFalse);
      expect(ios.haptics, NativeHapticBoundary.systemImpactOnly);
      expect(ios.authoredHapticPatterns, isFalse);

      final desktop = NativeCapabilityContract.forTarget(TargetPlatform.macOS);
      expect(desktop.homeWidget, isFalse);
      expect(desktop.haptics, NativeHapticBoundary.unavailable);
    },
  );

  test('malformed fixture versions fail closed', () {
    expect(
      () => TodayResourceContract.fromJson({
        'schemaVersion': 2,
        'date': '2026-07-31',
        'timezone': 'UTC',
        'tasks': <Object?>[],
      }),
      throwsFormatException,
    );
  });

  testWidgets('scaffold identifies itself as contract-only', (tester) async {
    final today = TodayResourceContract.fromJson({
      'schemaVersion': 1,
      'date': '2026-07-31',
      'timezone': 'Asia/Kolkata',
      'tasks': [
        {
          'id': 'tsk_fixture_read',
          'title': 'Read',
          'track': 'trk_read',
          'done': true,
          'accentHex': '#4E8C3F',
        },
        {
          'id': 'tsk_fixture_walk',
          'title': 'Walk',
          'track': 'trk_walk',
          'done': false,
          'accentHex': '#D4553A',
        },
      ],
    });
    await tester.pumpWidget(MainApp(today: today));
    expect(find.text('Native contract scaffold'), findsOneWidget);
    expect(find.textContaining('not a full mobile app'), findsOneWidget);
    expect(find.textContaining('1 of 2 complete'), findsOneWidget);
  });

  testWidgets('clean launch does not render bundled fixture tasks', (
    tester,
  ) async {
    await tester.pumpWidget(const MainApp());
    await tester.pump();
    expect(find.textContaining('0 of 0 complete'), findsOneWidget);
    expect(find.text('Read'), findsNothing);
    expect(find.text('Walk'), findsNothing);
  });
}

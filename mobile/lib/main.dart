import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:soupz_tracker_mobile/contracts/tracker_contract.dart';

void main() {
  runApp(const MainApp());
}

class MainApp extends StatelessWidget {
  const MainApp({super.key, this.today});

  final TodayResourceContract? today;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Soupz Tracker mobile contract',
      theme: ThemeData(colorSchemeSeed: const Color(0xFFE2963C)),
      home: ContractSurface(today: today),
    );
  }
}

class ContractSurface extends StatefulWidget {
  const ContractSurface({super.key, this.today});

  final TodayResourceContract? today;

  @override
  State<ContractSurface> createState() => _ContractSurfaceState();
}

class _ContractSurfaceState extends State<ContractSurface> {
  late final Future<TodayResourceContract> _today = _loadToday();

  Future<TodayResourceContract> _loadToday() async {
    final now = DateTime.now();
    final date =
        '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return TodayResourceContract.fromJson({
      'schemaVersion': trackerSchemaVersion,
      'date': date,
      'timezone': 'local',
      'tasks': <Object?>[],
    });
  }

  @override
  Widget build(BuildContext context) {
    final capabilities = NativeCapabilityContract.forTarget(
      defaultTargetPlatform,
    );
    return Scaffold(
      appBar: AppBar(title: const Text('Soupz Tracker')),
      body: widget.today != null
          ? _content(context, widget.today!, capabilities)
          : FutureBuilder<TodayResourceContract>(
              future: _today,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const Center(
                    child: Text('Contract fixture is invalid.'),
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                return _content(context, snapshot.requireData, capabilities);
              },
            ),
    );
  }

  Widget _content(
    BuildContext context,
    TodayResourceContract today,
    NativeCapabilityContract capabilities,
  ) {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Native contract scaffold',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'This build validates the shared plan, today, widget, accent, and haptic contracts. It is not a full mobile app.',
        ),
        const SizedBox(height: 24),
        Text(
          '${today.completed} of ${today.tasks.length} complete on ${today.date}',
        ),
        Text(
          'Home widget contract: ${capabilities.homeWidget ? 'available' : 'unavailable'}',
        ),
        Text(
          'Haptics: ${capabilities.haptics.name}; authored patterns: ${capabilities.authoredHapticPatterns ? 'available' : 'not implemented'}',
        ),
      ],
    );
  }
}

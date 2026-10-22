from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prompts.models import PromptVersion

from .models import (
    EvaluationDataset,
    EvaluationRun,
    TestCase,
)
from .serializers import (
    EvaluationDatasetSerializer,
    EvaluationRunCreateSerializer,
    EvaluationRunSerializer,
    TestCaseSerializer,
)
from .services import run_evaluation


# ============================================================
# DATASET VIEWS
# ============================================================

class EvaluationDatasetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        datasets = (
            EvaluationDataset.objects
            .filter(owner=request.user)
            .prefetch_related("test_cases")
        )

        serializer = EvaluationDatasetSerializer(
            datasets,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = EvaluationDatasetSerializer(
            data=request.data
        )

        if serializer.is_valid():
            dataset = serializer.save(
                owner=request.user
            )

            return Response(
                EvaluationDatasetSerializer(dataset).data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


class EvaluationDatasetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_dataset(self, request, pk):
        return get_object_or_404(
            EvaluationDataset.objects.prefetch_related(
                "test_cases"
            ),
            pk=pk,
            owner=request.user,
        )

    def get(self, request, pk):
        dataset = self.get_dataset(request, pk)

        serializer = EvaluationDatasetSerializer(
            dataset
        )

        return Response(serializer.data)

    def put(self, request, pk):
        dataset = self.get_dataset(request, pk)

        serializer = EvaluationDatasetSerializer(
            dataset,
            data=request.data,
        )

        if serializer.is_valid():
            serializer.save()

            return Response(
                EvaluationDatasetSerializer(dataset).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def patch(self, request, pk):
        dataset = self.get_dataset(request, pk)

        serializer = EvaluationDatasetSerializer(
            dataset,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            serializer.save()

            return Response(
                EvaluationDatasetSerializer(dataset).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        dataset = self.get_dataset(request, pk)

        dataset.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# ============================================================
# TEST CASE VIEWS
# ============================================================

class DatasetTestCaseListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get_dataset(self, request, dataset_id):
        return get_object_or_404(
            EvaluationDataset,
            pk=dataset_id,
            owner=request.user,
        )

    def get(self, request, dataset_id):
        dataset = self.get_dataset(
            request,
            dataset_id,
        )

        test_cases = (
            dataset.test_cases
            .all()
            .order_by("sort_order", "id")
        )

        serializer = TestCaseSerializer(
            test_cases,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request, dataset_id):
        dataset = self.get_dataset(
            request,
            dataset_id,
        )

        serializer = TestCaseSerializer(
            data=request.data
        )

        if serializer.is_valid():
            test_case = serializer.save(
                dataset=dataset
            )

            return Response(
                TestCaseSerializer(test_case).data,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


class TestCaseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_test_case(self, request, pk):
        return get_object_or_404(
            TestCase.objects.select_related(
                "dataset"
            ),
            pk=pk,
            dataset__owner=request.user,
        )

    def get(self, request, pk):
        test_case = self.get_test_case(
            request,
            pk,
        )

        serializer = TestCaseSerializer(
            test_case
        )

        return Response(serializer.data)

    def put(self, request, pk):
        test_case = self.get_test_case(
            request,
            pk,
        )

        serializer = TestCaseSerializer(
            test_case,
            data=request.data,
        )

        if serializer.is_valid():
            serializer.save()

            return Response(
                TestCaseSerializer(test_case).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def patch(self, request, pk):
        test_case = self.get_test_case(
            request,
            pk,
        )

        serializer = TestCaseSerializer(
            test_case,
            data=request.data,
            partial=True,
        )

        if serializer.is_valid():
            serializer.save()

            return Response(
                TestCaseSerializer(test_case).data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        test_case = self.get_test_case(
            request,
            pk,
        )

        test_case.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


# ============================================================
# EVALUATION RUN VIEWS
# ============================================================

class EvaluationRunListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        runs = (
            EvaluationRun.objects
            .filter(owner=request.user)
            .select_related(
                "prompt",
                "prompt_version",
                "dataset",
            )
            .prefetch_related(
                "results__test_case"
            )
        )

        serializer = EvaluationRunSerializer(
            runs,
            many=True,
        )

        return Response(serializer.data)

    def post(self, request):
        serializer = EvaluationRunCreateSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt_version_id = (
            serializer.validated_data["prompt_version"]
        )

        dataset_id = (
            serializer.validated_data["dataset"]
        )

        model = (
            serializer.validated_data["model"]
            .strip()
        )

        # ----------------------------------------------------
        # Verify prompt version belongs to current user
        # ----------------------------------------------------

        prompt_version = get_object_or_404(
            PromptVersion.objects.select_related(
                "prompt"
            ),
            pk=prompt_version_id,
            prompt__owner=request.user,
        )

        # ----------------------------------------------------
        # Verify dataset belongs to current user
        # ----------------------------------------------------

        dataset = get_object_or_404(
            EvaluationDataset,
            pk=dataset_id,
            owner=request.user,
        )

        # ----------------------------------------------------
        # Dataset must contain test cases
        # ----------------------------------------------------

        test_case_count = dataset.test_cases.count()

        if test_case_count == 0:
            return Response(
                {
                    "detail": (
                        "The selected dataset has no test cases."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # Create evaluation run
        # ----------------------------------------------------

        evaluation_run = EvaluationRun.objects.create(
            owner=request.user,
            prompt=prompt_version.prompt,
            prompt_version=prompt_version,
            dataset=dataset,
            model=model,
            status="running",
            total_cases=test_case_count,
            passed_cases=0,
            failed_cases=0,
            started_at=timezone.now(),
        )

        # ----------------------------------------------------
        # Execute evaluation
        # ----------------------------------------------------

        try:
            has_error = run_evaluation(
                evaluation_run
            )

            evaluation_run.completed_at = timezone.now()

            evaluation_run.status = (
                "failed"
                if has_error
                else "completed"
            )

            evaluation_run.save()

        except Exception as exc:

            evaluation_run.status = "failed"

            evaluation_run.error_message = str(exc)

            evaluation_run.completed_at = (
                timezone.now()
            )

            evaluation_run.save(
                update_fields=[
                    "status",
                    "error_message",
                    "completed_at",
                ]
            )

        # ----------------------------------------------------
        # Return final result
        # ----------------------------------------------------

        evaluation_run.refresh_from_db()

        serializer = EvaluationRunSerializer(
            evaluation_run
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class EvaluationRunDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_run(self, request, pk):
        return get_object_or_404(
            EvaluationRun.objects
            .select_related(
                "prompt",
                "prompt_version",
                "dataset",
            )
            .prefetch_related(
                "results__test_case",
                "results__execution",
            ),
            pk=pk,
            owner=request.user,
        )

    def get(self, request, pk):
        evaluation_run = self.get_run(
            request,
            pk,
        )

        serializer = EvaluationRunSerializer(
            evaluation_run
        )

        return Response(serializer.data)